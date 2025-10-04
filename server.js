// server.js

// 1. Panggil (require) semua library yang dibutuhkan
const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
// Buat server HTTP dari aplikasi Express
const server = http.createServer(app);
// Inisialisasi Socket.IO dan kaitkan ke server HTTP
const io = socketio(server);

// --- DATABASE SIMULASI (Menggantikan localStorage) ---
let users = {}; // Untuk menyimpan akun
let chatLogs = []; // Untuk menyimpan riwayat chat

// Kunci RSA demo (untuk semua user)
const RSA_N = 3233, RSA_E = 17, RSA_D = 2753; 

// Middleware untuk melayani file statis (index.html)
// Ini membuat file di folder ini (C:\crypchat-rsa-realtime) bisa diakses di browser
app.use(express.static(__dirname)); 
app.use(express.json()); // Middleware agar bisa memproses body JSON dari request

// ----------------------------------------------------
// A. ENDPOINT API (Login/Register)
// ----------------------------------------------------

// Endpoint: Register
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(400).send({ success: false, message: "Username sudah terdaftar!" });
    }
    
    // Simpan data pengguna
    users[username] = { pwd: password, n: RSA_N, e: RSA_E, d: RSA_D };
    console.log(`[SERVER] User terdaftar: ${username}`);
    res.send({ success: true, message: "Registrasi berhasil!" });
});

// Endpoint: Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];

    if (!user || user.pwd !== password) {
        return res.status(401).send({ success: false, message: "Username atau password salah!" });
    }

    // Kirim Public dan Private Key ke klien (untuk enkripsi dan dekripsi)
    res.send({ success: true, pubKey: { n: user.n, e: user.e, d: user.d }, message: "Login berhasil!" });
});

// Endpoint: Mendapatkan Public Key Teman
app.get('/key/:username', (req, res) => {
    const friendName = req.params.username;
    const user = users[friendName];

    if (!user) {
        return res.status(404).send({ success: false, message: "Teman tidak ditemukan!" });
    }

    // Hanya kirim Public Key teman (n dan e)
    res.send({ success: true, pubKey: { n: user.n, e: user.e } });
});


// ----------------------------------------------------
// B. SOCKET.IO (Real-Time Chat Logic)
// ----------------------------------------------------

// Simpan koneksi socket.id untuk setiap user yang online
const userSockets = {}; // { 'username': 'socket.id' }

io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    // Menerima event 'user_online' dari klien setelah login
    socket.on('user_online', (username) => {
        userSockets[username] = socket.id;
        socket.username = username;
        console.log(`[SOCKET] ${username} sekarang online.`);
    });

    // Menerima event 'send_message'
    socket.on('send_message', (msgData) => {
        // Simpan pesan ke log
        chatLogs.push(msgData);

        // 1. Kirim pesan balik ke pengirim (untuk tampil di layarnya)
        socket.emit('new_message', msgData);

        // 2. Kirim pesan ke penerima
        const recipientSocketId = userSockets[msgData.to];
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('new_message', msgData);
            console.log(`[SOCKET] Pesan dikirim dari ${msgData.from} ke ${msgData.to}`);
        }
    });

    // Menerima event 'request_chat_history'
    socket.on('request_chat_history', ({ currentUser, currentFriend }) => {
        const history = chatLogs.filter(msg =>
            (msg.from === currentUser && msg.to === currentFriend) ||
            (msg.from === currentFriend && msg.to === currentUser)
        );
        socket.emit('chat_history', history);
    });

    // Event disconnect
    socket.on('disconnect', () => {
        if (socket.username) {
            // Hapus user dari daftar online
            delete userSockets[socket.username];
            console.log(`[SOCKET] ${socket.username} terputus/logout.`);
        }
    });
});


// ----------------------------------------------------
// C. JALANKAN SERVER
// ----------------------------------------------------

const PORT = 3000;
// Perintah ini yang memastikan server tetap berjalan dan mendengarkan koneksi
server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ Server CrypChat berjalan di: 'https://matdis4.onrender.com');
    console.log(`======================================================\n`);
});