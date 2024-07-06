const axios = require('axios');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
dotenv.config();

const gemini_api_key = process.env.API_KEY || "AIzaSyBGPFXf-uGC4wnbQR4beR43eqhQpq0dqY0";
const googleAI = new GoogleGenerativeAI(gemini_api_key);
const geminiConfig = {
  temperature: 0.9,
  topP: 1,
  topK: 1,
  maxOutputTokens: 4096,
};

const geminiModel = googleAI.getGenerativeModel({
  model: "gemini-pro",
  geminiConfig,
});

async function generateResponse(incomingMessages) {
  try {
    const result = await geminiModel.generateContent(incomingMessages);
    const geminiResponse = result.response;
    return geminiResponse.text();
  } catch (error) {
    console.error("Error generating response with Gemini:", error);
    return "Maaf, terjadi kesalahan saat memproses pesan Anda."; // Default error message
  }
}

const firebaseDatabaseUrl = 'https://chatbot-e4c87-default-rtdb.firebaseio.com';

async function getMessagesFromFirebase() {
  try {
    const response = await axios.get(`${firebaseDatabaseUrl}/messages.json`);
    console.log('Data fetched from Firebase:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching messages from Firebase:', error);
    return null;
  }
}

async function sendMessageAtSpecificTime(sock, targetJid, message, targetDate, messageId) {
  const currentTime = new Date().getTime();
  const targetTime = targetDate.getTime();
  const delay = targetTime - currentTime;

  if (delay > 0) {
    setTimeout(async () => {
      try {
        await sock.sendMessage(targetJid, { text: message });
        console.log(`Pesan teks terkirim ke ${targetJid} pada ${targetDate}.`);
        await markMessageAsProcessed(messageId);
      } catch (error) {
        console.error(`Gagal mengirim pesan teks ke ${targetJid}:`, error);
      }
    }, delay);
  } else {
    console.log('Waktu yang ditentukan sudah lewat.');
  }
}

async function sendImage(sock, targetJid, imageUrl, caption, messageId) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    await sock.sendMessage(targetJid, { image: imageBuffer, caption });
    console.log(`Gambar terkirim ke ${targetJid}`);
    await markMessageAsProcessed(messageId);
  } catch (error) {
    console.error('Error sending image:', error);
  }
}

async function markMessageAsProcessed(messageId) {
  try {
    await axios.patch(`${firebaseDatabaseUrl}/messages/${messageId}.json`, {
      processed: true
    });
    console.log(`Pesan dengan ID ${messageId} telah ditandai sebagai diproses.`);
  } catch (error) {
    console.error('Error marking message as processed:', error);
  }
}

async function processMessages(sock) {
  const messagesData = await getMessagesFromFirebase();
  if (messagesData) {
    for (const [key, value] of Object.entries(messagesData)) {
      if (!value.processed) {
        const targetDate = new Date(value.targetDate);
        const targetJid = value.targetJid.replace(/['"]+/g, ''); // Remove quotes if any
        if (value.type === 'text') {
          const formattedContent = value.content.replace(/\\n/g, '\n'); // Replace \n with actual newlines
          sendMessageAtSpecificTime(sock, targetJid, formattedContent, targetDate, key);
        } else if (value.type === 'image') {
          const formattedCaption = value.caption.replace(/\\n/g, '\n'); // Replace \n with actual newlines
          await sendImage(sock, targetJid, value.imageUrl, formattedCaption, key);
        }
      }
    }
  }
}

  //info sock HMBI: '120363163312129637@g.us'
    //info ppni Karawang '120363044573094419@g.us'
    //ICO 1 '120363162183976678@g.us'
    //ICO 2 '120363162768337998@g.us'
    //Inno 1 '120363029562607086@g.us'
    //Inno 2 '120363030052837165@g.us'
    //MEC '120363039655415935@g.us'
    //AHI '6285693335165-1525781294@g.us'
    //Webinar '120363277409587491@g.us'
    //RME '120363186013542533@g.us'
    //Startup Nusantara '120363115791085529@g.us'
    //Collab Uang '120363048188666997@g.us'
    //St Frans '6282134349123-1494248370@g.us'
    //NW '120363038707327926@g.us'
    //Pertanian Teknologi '120363163875111753@g.us'
    //Early MD '120363048054248610@g.us'
    //Haris '6285728091945@s.whatsapp.net'

async function connectToWhatsApp() {
  try {
    console.log('Mencoba menghubungkan ke WhatsApp...');

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      defaultQueryTimeoutMs: undefined
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      console.log('Status Koneksi: ', connection);
      if (lastDisconnect) {
        console.log('Detail Pemutusan Koneksi: ', lastDisconnect.error);
      }
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect.error instanceof Boom && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Koneksi terputus karena ', lastDisconnect.error, ', hubungkan kembali!', shouldReconnect);
        if (shouldReconnect) {
          connectToWhatsApp();
        }
      } else if (connection === 'open') {
        console.log('Koneksi tersambung!');

        // Mulai polling Firebase setiap 60 detik
        setInterval(() => {
          processMessages(sock);
        }, 60000);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      console.log('Message Type: ', type);
      console.log('Messages: ', messages);

      if (type === "notify" && messages && messages.length > 0) {
        try {
          const message = messages[0];
          const senderNumber = message.key.remoteJid;
          let incomingMessages = '';

          if (message.message && message.message.conversation) {
            incomingMessages = message.message.conversation;
          } else if (message.message.extendedTextMessage && message.message.extendedTextMessage.text) {
            incomingMessages = message.message.extendedTextMessage.text;
          }

          const isMessageFromGroup = senderNumber.endsWith('@g.us');
          const isMessageMentionedBot = incomingMessages.includes('@62895600394345'); // Adjust this based on your bot's mention format

          if (isMessageFromGroup && isMessageMentionedBot) {
            const result = await generateResponse(incomingMessages);
            await sock.sendMessage(senderNumber, { text: result });
          } else {
            const lowerCaseMessage = incomingMessages.toLowerCase();
            let replyMessage = '';

            if (lowerCaseMessage.includes('eko')) {
              replyMessage = "Hai...mohon tunggu, ya... 🤖'Dari: Robot Assisten Eko'";
            } else if (lowerCaseMessage.includes('rme')) {
              replyMessage = "Investasi RME MedicTech support all layanan tenaga medis, investasi 1x bayar di pakai selamanya...Investasi Rp.2.980.000, full fitur: resep otomatis dosis akurat rekomendasi obat lengkap 🤖";
            } else if (lowerCaseMessage.includes('dosis')) {
              replyMessage = "Informasi Dosis Obat Akurat: https://dosisakurat.vercel.app 🤖";
            }

            if (replyMessage) {
              await sock.sendMessage(senderNumber, { text: replyMessage });
            }
          }
        } catch (error) {
          console.error('Error handling WhatsApp message:', error);
        }
      }
    });

    await sock.connect();
  } catch (error) {
    console.error('Error connecting to WhatsApp:', error);
  }
}

// Connect to WhatsApp when script starts
connectToWhatsApp();
