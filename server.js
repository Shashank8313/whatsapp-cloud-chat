const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MONGO_URI = "mongodb+srv://renjidps_db_user:6984DucBCESAKCjc@cluster0.p769m.mongodb.net/whatsapp_db?retryWrites=true&w=majority";

// Connection logic that waits to ensure stability
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("☁️ Successfully connected to MongoDB!");
    })
    .catch(err => console.error("❌ Connection Error:", err));

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

io.on('connection', (socket) => {
    socket.on('request-login', async (data) => {
        let user = await User.findOne({ username: data.username, password: data.password });
        
        // Force admin role for your account
        let role = (data.username === 'Shashankkm') ? 'admin' : (user ? user.role : 'user');
        
        if (!user && data.username === 'Shashankkm') {
            user = await User.create({ username: data.username, password: data.password, role: 'admin' });
        }

        if (user) {
            socket.emit('auth-response', { success: true, username: user.username, role: role });
        } else {
            socket.emit('auth-response', { success: false, message: "Invalid login" });
        }
    });

    socket.on('create-new-room', async (name) => {
        await Channel.create({ name, messages: [] });
        io.emit('sync-all-rooms', await Channel.find({}));
    });
});

server.listen(process.env.PORT || 10000, () => console.log("🚀 Server Ready"));
