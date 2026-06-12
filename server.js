const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Database URI - ensure your password is correct in this string
const MONGO_URI = "mongodb+srv://renjidps_db_user:6984DucBCESAKCjc@cluster0.p769m.mongodb.net/whatsapp_db?retryWrites=true&w=majority";

// Schemas
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    role: { type: String, default: 'user' }
}));

app.use(express.static(path.join(__dirname, '/')));

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("☁️ Successfully connected to MongoDB!");
    })
    .catch(err => {
        console.error("❌ Connection Error:", err);
    });

// Socket Logic
io.on('connection', (socket) => {
    socket.on('request-login', async (data) => {
        const user = await User.findOne({ username: data.username, password: data.password });
        if (user) {
            const role = (data.username === 'Shashankkm') ? 'admin' : user.role;
            socket.emit('auth-response', { success: true, username: user.username, role: role });
        } else {
            socket.emit('auth-response', { success: false, message: "Invalid login" });
        }
    });
});

// Port configuration
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server Ready on port ${PORT}`));
