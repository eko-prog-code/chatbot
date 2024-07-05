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
        
            if (type === "notify" && messages && messages.length > 0) {
                try {
                    const message = messages[0];
                    const senderNumber = message.key.remoteJid;
                    let incomingMessages = '';

                    // Cek apakah pesan mengandung 'conversation'
                    if (message.message && message.message.conversation) {
                        incomingMessages = message.message.conversation;
                    } else if (message.message.extendedTextMessage && message.message.extendedTextMessage.text) {
                        incomingMessages = message.message.extendedTextMessage.text;
                    }

                    console.log("Nomer Pengirim: ", senderNumber);
                    console.log("Isi Pesan: ", incomingMessages);

                    // Cek apakah pesan berasal dari grup
                    if (senderNumber.endsWith('@g.us')) {
                        const isMentioned = message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo && message.message.extendedTextMessage.contextInfo.mentionedJid;

                        // Cek apakah bot disebut dalam pesan
                        if (isMentioned && message.message.extendedTextMessage.contextInfo.mentionedJid.includes('62895600394345@s.whatsapp.net')) {
                            if (incomingMessages.toLowerCase().includes("rme")) {
                                const replyMessage = "Investasi RME MedicTech support all layanan tenaga medis, investasi 1x bayar di pakai selamanya...Investasi Rp.2.980.000 dapatkan akses selamanya (Robot Assisten ~ Eko Setiaji)";
                                await sock.sendMessage(senderNumber, { text: replyMessage });
                            } else {
                                const replyMessage = "Hai, (Robot Assisten ~ Eko Setiaji) siap membantu..., silahkan mention dan beri pertanyaan";
                                await sock.sendMessage(senderNumber, { text: replyMessage });
                            }
                        }
                    } else {
                        // Cek apakah pesan pribadi mengandung kata "selamat"
                        if (incomingMessages.toLowerCase().includes("selamat")) {
                            const replyMessage = "Hai..dengan Eko Setiaji, bisa kami bantu";
                            await sock.sendMessage(senderNumber, { text: replyMessage });
                        }
                    }
                } catch (error) {
                    console.log("Error saat memproses pesan: ", error);
                }
            }
        });

    } catch (err) {
        console.error('Ada Error dalam koneksi: ', err);
    }
}

connectToWhatsApp().catch((err) => {
    console.error('Ada Error dalam koneksi: ', err);
});
