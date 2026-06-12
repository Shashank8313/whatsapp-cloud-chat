const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// This reads the URI from the Environment Variable you will set in Render
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ FATAL ERROR: MONGO_URI is not defined in Environment Variables");
    process.exit(1);
}

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    role: { type: String, default: 'user' }
}));

app.use(express.static(path.join(__dirname, '/')));

// Database connection
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("☁️ Successfully connected to MongoDB!");
        server.listen(process.env.PORT || 10000, () => console.log("🚀 Server Ready"));
    })
    .catch(err => {
        console.error("❌ Connection Error:", err);
    });

io.on('connection', (socket) => {
    // Registration Logic
    socket.on('request-register', async (data) => {
        try {
            await User.create({ username: data.username, password: data.password, role: 'user' });
            socket.emit('auth-response', { success: true, message: "Registered! Now Log In." });
        } catch (e) {
            socket.emit('auth-response', { success: false, message: "Username already exists." });
        }
    });

    // Login Logic
    socket.on('request-login', async (data) => {
        try {
            const user = await User.findOne({ username: data.username, password: data.password });
            if (user) {
                const role = (data.username === 'Shashankkm') ? 'admin' : user.role;
                socket.emit('auth-response', { success: true, username: user.username, role: role });
            } else {
                socket.emit('auth-response', { success: false, message: "Invalid credentials." });
            }
        } catch (e) {
            socket.emit('auth-response', { success: false, message: "Login failure." });
        }
    });
});
