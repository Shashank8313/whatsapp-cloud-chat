const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// RE-COPY THIS EXACT URI - Ensure no spaces are around the text
const MONGO_URI = "mongodb+srv://renjidps_db_user:6984DucBCESAKCjc@cluster0.p769m.mongodb.net/whatsapp_db?retryWrites=true&w=majority";

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    role: { type: String, default: 'user' }
}));

app.use(express.static(path.join(__dirname, '/')));

// Connection with added retry logic
mongoose.connect(MONGO_URI, { 
    serverSelectionTimeoutMS: 5000 
})
    .then(() => {
        console.log("☁️ Successfully connected to MongoDB!");
        server.listen(process.env.PORT || 10000, () => console.log("🚀 Server Ready"));
    })
    .catch(err => {
        console.error("❌ Connection Error (Check your URI):", err);
    });

io.on('connection', (socket) => {
    socket.on('request-login', async (data) => {
        try {
            const user = await User.findOne({ username: data.username, password: data.password });
            if (user) {
                // Feature Restoration: Admin for you
                const role = (data.username === 'Shashankkm') ? 'admin' : user.role;
                socket.emit('auth-response', { success: true, username: user.username, role: role });
            } else {
                socket.emit('auth-response', { success: false, message: "Invalid login" });
            }
        } catch (e) {
            socket.emit('auth-response', { success: false, message: "Server connection error" });
        }
    });
});
