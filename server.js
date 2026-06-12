const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use your specific MongoDB URI
const MONGO_URI = "mongodb+srv://renjidps_db_user:6984DucBCESAKCjc@cluster0.p769m.mongodb.net/whatsapp_db?retryWrites=true&w=majority";

// Schemas
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

// --- DATABASE CONNECTION & SERVER START ---
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("☁️ Successfully connected to MongoDB!");
        
        // Start the server ONLY after DB connection is ready
        const PORT = process.env.PORT || 10000;
        server.listen(PORT, () => console.log(`🚀 Server Ready on port ${PORT}`));
    })
    .catch(err => {
        console.error("❌ Connection Error:", err);
        process.exit(1); // Exit if DB fails to prevent unstable state
    });

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    socket.on('request-login', async (data) => {
        try {
            let user = await User.findOne({ username: data.username, password: data.password });
            
            // Logic to restore your admin features
            let role = (data.username === 'Shashankkm') ? 'admin' : (user ? user.role : 'user');
            
            if (user) {
                socket.emit('auth-response', { success: true, username: user.username, role: role });
            } else {
                socket.emit('auth-response', { success: false, message: "Invalid login credentials." });
            }
        } catch (err) {
            socket.emit('auth-response', { success: false, message: "Database lookup failed." });
        }
    });

    socket.on('create-new-room', async (name) => {
        try {
            await Channel.create({ name, messages: [] });
            io.emit('sync-all-rooms', await Channel.find({}));
        } catch (e) { console.error(e); }
    });
});
