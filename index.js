const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
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

async function connectToWhatsApp() {
  try {
    console.log('Mencoba menghubungkan ke WhatsApp...');

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      defaultQueryTimeoutMs: undefined
    });

    sock.ev.on('connection.update', (update) => {
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
              replyMessage = "Hai...mohon tunggu, ya...'Dari: Robot Assisten Eko'";
            } else if (lowerCaseMessage.includes('rme')) {
              replyMessage = "Investasi RME MedicTech support all layanan tenaga medis, investasi 1x bayar di pakai selamanya...Investasi Rp.2.980.000, full fitur: resep otomatis dosis akurat rekomendasi obat lengkap";
            } else if (lowerCaseMessage.includes('dosis')) {
              replyMessage = "Informasi Dosis Obat Akurat: https://dosisakurat.vercel.app";
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
