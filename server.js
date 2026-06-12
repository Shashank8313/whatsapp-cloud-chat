const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MONGO_URI = "mongodb+srv://renjidps_db_user:6984DucBCESAKCjc@cluster0.p769m.mongodb.net/whatsapp_db?retryWrites=true&w=majority";

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    role: { type: String, default: 'user' }
}));

const Channel = mongoose.model('Channel', new mongoose.Schema({
    name: { type: String, unique: true },
    pfp: { type: String, default: '' },
    messages: Array
}));

app.use(express.static(path.join(__dirname, '/')));

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("☁️ Successfully connected to MongoDB!");
        server.listen(process.env.PORT || 10000, () => console.log("🚀 Server Ready"));
    })
    .catch(err => console.error("❌ Connection Error:", err));

io.on('connection', (socket) => {
    // Handle Registration
    socket.on('request-register', async (data) => {
        try {
            const exists = await User.findOne({ username: data.username });
            if (exists) {
                socket.emit('auth-response', { success: false, message: "Username exists." });
            } else {
                await User.create({ username: data.username, password: data.password });
                socket.emit('auth-response', { success: true, isRegister: true });
            }
        } catch (e) { socket.emit('auth-response', { success: false, message: "Register error." }); }
    });

    // Handle Login
    socket.on('request-login', async (data) => {
        try {
            const user = await User.findOne({ username: data.username, password: data.password });
            if (user) {
                const role = (data.username === 'Shashankkm') ? 'admin' : user.role;
                socket.emit('auth-response', { success: true, username: user.username, role: role });
            } else {
                socket.emit('auth-response', { success: false, message: "Invalid credentials." });
            }
        } catch (e) { socket.emit('auth-response', { success: false, message: "Login error." }); }
    });
});
