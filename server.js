const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Double-check this URI for any accidental spaces or hidden characters
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
    .catch(err => {
        console.error("❌ Connection Error:", err);
        // Do not use process.exit(1) here if you want Render to attempt a retry
    });

io.on('connection', (socket) => {
    socket.on('request-register', async (data) => {
        try {
            await User.create({ username: data.username, password: data.password, role: 'user' });
            socket.emit('auth-response', { success: true, message: "Registered! Now Log In." });
        } catch (e) { socket.emit('auth-response', { success: false, message: "User exists." }); }
    });

    socket.on('request-login', async (data) => {
        try {
            const user = await User.findOne({ username: data.username, password: data.password });
            if (user) {
                // Admin features restored for your account
                const role = (data.username === 'Shashankkm') ? 'admin' : user.role;
                socket.emit('auth-response', { success: true, username: user.username, role: role });
            } else {
                socket.emit('auth-response', { success: false, message: "Invalid credentials." });
            }
        } catch (e) { socket.emit('auth-response', { success: false, message: "Login failed." }); }
    });
});
