const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 🔌 Connect directly to your MongoDB Cloud Database
const MONGO_URI = "mongodb+srv://renjidps_db_user:6984DucBCESAKCjc@cluster0.p769m.mongodb.net/whatsapp_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("☁️ Successfully connected to MongoDB Cloud Database!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- MONGOOSE SCHEMAS & MODELS ---

// User Account Schema
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
});
const User = mongoose.model('User', userSchema);

// Chat Message Schema
const messageSchema = new mongoose.Schema({
    type: { type: String, default: 'msg' }, // 'msg' or 'system'
    sender: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});

// Chat Room / Channel Schema
const channelSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    pfp: { type: String, default: '' },
    messages: [messageSchema]
});
const Channel = mongoose.model('Channel', channelSchema);

// Serve Static Frontend Files (index.html)
app.use(express.static(path.join(__dirname, '/')));

// --- CORE APP LOGIC & SEEDING ---

// Automatically create default starter rooms if the database is empty
async function seedDefaultRooms() {
    try {
        const defaultRooms = ["WhatsApp Updates", "Global Lounge"];
        for (const roomName of defaultRooms) {
            const existing = await Channel.findOne({ name: roomName });
            if (!existing) {
                await Channel.create({ name: roomName, pfp: '', messages: [] });
                console.log(`🏠 Starter room created: ${roomName}`);
            }
        }
    } catch (err) {
        console.error("Error seeding default rooms:", err);
    }
}
seedDefaultRooms();

// Helper helper function to get all rooms formatted for the frontend
async function getAllRoomsMetadata() {
    const channels = await Channel.find({});
    const metadata = {};
    channels.forEach(ch => {
        metadata[ch.name] = { pfp: ch.pfp || '' };
    });
    return metadata;
}

// --- SOCKET.IO REAL-TIME ROUTING ---

io.on('connection', (socket) => {
    let sessionUsername = "";

    // 1. Handle Registration Requests
    socket.on('request-register', async (data) => {
        try {
            const { username, password } = data;
            const existingUser = await User.findOne({ username });

            if (existingUser) {
                return socket.emit('auth-response', { success: false, message: "Username already exists!" });
            }

            // Determine role setup
            let assignedRole = 'user';
            if (username === 'Shashankkm' || username === 'renjidps_db_user') {
                assignedRole = 'admin';
            }

            const newUser = new User({ username, password, role: assignedRole });
            await newUser.save();

            socket.emit('auth-response', { success: true, isRegister: true });
        } catch (err) {
            socket.emit('auth-response', { success: false, message: "Server registration error." });
        }
    });

    // 2. Handle Login Requests
    socket.on('request-login', async (data) => {
        try {
            const { username, password } = data;
            const user = await User.findOne({ username, password });

            if (!user) {
                return socket.emit('auth-response', { success: false, message: "Invalid username or password!" });
            }

            // 🚀 FORCE WHITELIST: Double-check admin privileges right here
            if (user.username === 'Shashankkm' || user.username === 'renjidps_db_user') {
                user.role = 'admin';
            }

            sessionUsername = user.username;
            const roomsData = await getAllRoomsMetadata();

            socket.emit('auth-response', {
                success: true,
                isRegister: false,
                username: user.username,
                role: user.role,
                roomsData: roomsData
            });
        } catch (err) {
            socket.emit('auth-response', { success: false, message: "Server authentication login error." });
        }
    });

    // 3. User Joins Main Chat Instance
    socket.on('new-user', (username) => {
        sessionUsername = username;
        console.log(`👤 User connected: ${username}`);
    });

    // 4. User Joins a Specific Room
    socket.on('join-room', async (roomName) => {
        // Leave previous rooms
        const currentRooms = Array.from(socket.rooms);
        currentRooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        socket.join(roomName);

        // Fetch room from DB to load past messages
        const channel = await Channel.findOne({ name: roomName });
        if (channel) {
            socket.emit('sync-room-history', {
                room: roomName,
                history: channel.messages
            });
        }
    });

    // 5. Handling Live Messaging
    socket.on('send-chat-message', async (data) => {
        const { room, message } = data;
        if (!sessionUsername || !room || !message) return;

        const newMsg = {
            type: 'msg',
            sender: sessionUsername,
            text: message,
            timestamp: new Date()
        };

        // Save straight to MongoDB collection array
        await Channel.findOneAndUpdate(
            { name: room },
            { $push: { messages: newMsg } }
        );

        // Broadcast out to everyone in the room live
        io.to(room).emit('chat-message', {
            room: room,
            message: message,
            name: sessionUsername
        });
    });

    // 6. Admin Control: Create a Brand New Room
    socket.on('create-new-room', async (roomName) => {
        try {
            const existing = await Channel.findOne({ name: roomName });
            if (existing) return;

            const newChannel = new Channel({ name: roomName, pfp: '', messages: [] });
            await newChannel.save();

            // Notify everyone's sidebar layout to update live
            const roomsData = await getAllRoomsMetadata();
            io.emit('sync-all-rooms', roomsData);
        } catch (err) {
            console.error("Error creating room:", err);
        }
    });

    // 7. Admin Control: Update Room Profile Picture
    socket.on('update-room-pfp', async (data) => {
        try {
            const { room, pfpUrl } = data;
            await Channel.findOneAndUpdate({ name: room }, { pfp: pfpUrl });

            // Broadcast room state change sync
            const roomsData = await getAllRoomsMetadata();
            io.emit('sync-all-rooms', roomsData);

            // Send a nice system note indicating profile changes
            const systemMsg = {
                type: 'system',
                sender: 'System',
                text: `⚙️ Room icon was updated by an administrator.`,
                timestamp: new Date()
            };

            await Channel.findOneAndUpdate({ name: room }, { $push: { messages: systemMsg } });
            io.to(room).emit('system-message', { room: room, text: systemMsg.text });
        } catch (err) {
            console.error("Error updating profile icon:", err);
        }
    });

    // 8. Connection cleanup
    socket.on('disconnect', () => {
        if (sessionUsername) {
            console.log(`🚪 User disconnected: ${sessionUsername}`);
        }
    });
});

// Start listening on Render's dynamic port environment or fallback to 10000 local
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server running smoothly on port ${PORT}`);
});
