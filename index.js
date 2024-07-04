const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

async function connectToWhatsApp() {
    try {
        console.log('Mencoba menghubungkan ke WhatsApp...');
        
        // Menggunakan useMultiFileAuthState untuk mengambil state dan fungsi saveCreds
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
                const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
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
            console.log('Tipe Pesan: ', type);
            console.log('Pesan: ', messages);
            if (type === "notify") {
                try {
                    // dapatkan nomor pengirim
                    const senderNumber = messages[0].key.remoteJid;
                    let incomingMessages = messages[0].message.conversation;
                    incomingMessages = incomingMessages.toLowerCase();
        
                    if (messages[0].message.conversation) {
                        incomingMessages = messages[0].message.conversation;
                    } else if (messages[0].message.extendedTextMessage) {
                        incomingMessages = messages[0].message.extendedTextMessage.text;
                    } else if (messages[0].message.imageMessage) {
                        incomingMessages = "Image Message";
                    } // tambahkan else if blok lainnya untuk tipe pesan lain jika diperlukan
        
                    console.log("Nomer Pengirim: ", senderNumber);
                    console.log("Isi Pesan: ", incomingMessages);
        
                    // Respons berdasarkan isi pesan
                    let responseMessage = "";
                    if (incomingMessages.includes("selamat")) {
                        responseMessage = "Hai...dengan Eko Setiaji Founder MedicTech, bisa kami bantu?";
                    }
        
                    if (responseMessage) {
                        await sock.sendMessage(senderNumber, { text: responseMessage });
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        });
        
        

    } catch (err) {
        console.error('Ada Error: ', err);
    }
}

connectToWhatsApp().catch((err) => {
    console.error('Ada Error dalam koneksi: ', err);
});
