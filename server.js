const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

// ☁️ Your custom Cloud Database link with the updated password
const MONGO_URI = "mongodb+srv://renjidps_db_user:6984DucBCESAKCjc@cluster0.as355hu.mongodb.net/discord-whatsapp?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB Cloud
mongoose.connect(MONGO_URI)
    .then(() => console.log("☁️ Successfully connected to MongoDB Cloud Database!"))
    .catch(err => console.error("❌ Cloud Connection Error:", err));

// Create the structure for cloud storage
const ChannelSchema = new mongoose.Schema({
    roomName: { type: String, unique: true, required: true },
    pfp: { type: String, default: "" },
    messages: { type: Array, default: [] }
});
const Channel = mongoose.model('Channel', ChannelSchema);

// User Accounts List
const users = {
    "shashankm": { username: "Shashankm", password: "123", role: "admin" },
    "shashank": { username: "Shashank", password: "123", role: "user" }
};

// Automatically set up your default chat rooms in the cloud if they don't exist yet
async function seedDefaultChannels() {
    const defaults = ["WhatsApp Updates", "Global Lounge"];
    for (let r of defaults) {
        const exists = await Channel.findOne({ roomName: r });
        if (!exists) {
            let welcomeText = `Welcome to the public ${r} chat room.`;
            if (r === "WhatsApp Updates") {
                welcomeText = "This group will send all the updates of WhatsApp the one we use there.";
            }
            await Channel.create({
                roomName: r,
                pfp: "",
                messages: [{ type: 'system', text: welcomeText }]
            });
        }
    }
}
seedDefaultChannels();

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

io.on('connection', (socket) => {
    let sessionUser = "";

    socket.on('request-login', async (data) => {
        const { username, password } = data;
        const lowerName = String(username).trim().toLowerCase();

        if (!users[lowerName] || users[lowerName].password !== password) {
            return socket.emit('auth-response', { success: false, message: "Invalid credentials." });
        }

        sessionUser = users[lowerName].username;
        
        // Fetch active channel structures directly from cloud database
        const channels = await Channel.find({});
        const roomsMetadata = {};
        channels.forEach(c => {
            roomsMetadata[c.roomName] = { pfp: c.pfp || "" };
        });

        socket.emit('auth-response', { 
            success: true, 
            username: users[lowerName].username, 
            role: users[lowerName].role,
            roomsData: roomsMetadata
        });
    });

    socket.on('request-register', (data) => {
        const { username, password } = data;
        if (!username || !password) return socket.emit('auth-response', { success: false, message: "Missing fields." });

        const lowerName = username.trim().toLowerCase();
        if (users[lowerName]) return socket.emit('auth-response', { success: false, message: "Username already exists." });

        users[lowerName] = { username: username.trim(), password: password, role: "user" };
        socket.emit('auth-response', { success: true, isRegister: true });
    });

    socket.on('new-user', (username) => {
        sessionUser = username.trim();
        socket.to("Global Lounge").emit('system-message', {
            room: "Global Lounge",
            text: `✨ ${sessionUser} joined the chat!`
        });
    });

    socket.on('join-room', async (roomName) => {
        socket.join(roomName);
        
        let channel = await Channel.findOne({ roomName: roomName });
        if (!channel) {
            channel = await Channel.create({ roomName: roomName, pfp: "", messages: [] });
        }
        
        socket.emit('sync-room-history', { 
            room: roomName, 
            history: channel.messages || [],
            pfp: channel.pfp || ""
        });
        
        const allChannels = await Channel.find({});
        const updatePayload = {};
        allChannels.forEach(c => { updatePayload[c.roomName] = { pfp: c.pfp || "" }; });
        io.emit('sync-all-rooms', updatePayload);
    });

    socket.on('create-new-room', async (roomName) => {
        let channel = await Channel.findOne({ roomName: roomName });
        if (!channel) {
            await Channel.create({ roomName: roomName, pfp: "", messages: [] });
            
            const allChannels = await Channel.find({});
            const updatePayload = {};
            allChannels.forEach(c => { updatePayload[c.roomName] = { pfp: c.pfp || "" }; });
            io.emit('sync-all-rooms', updatePayload);
        }
    });

    socket.on('update-room-pfp', async (data) => {
        const { room, pfpUrl } = data;
        await Channel.findOneAndUpdate({ roomName: room }, { pfp: pfpUrl });
        
        const allChannels = await Channel.find({});
        const updatePayload = {};
        allChannels.forEach(c => { updatePayload[c.roomName] = { pfp: c.pfp || "" }; });
        io.emit('sync-all-rooms', updatePayload);
    });

    socket.on('send-chat-message', async (data) => {
        if (!sessionUser) return;
        
        const currentRole = (sessionUser.toLowerCase() === 'shashankm') ? 'admin' : 'user';
        if (data.room === "WhatsApp Updates" && currentRole !== 'admin') return;

        const msgObj = { type: 'msg', sender: sessionUser, text: data.message };
        
        // Save history inside MongoDB Cloud arrays seamlessly
        await Channel.findOneAndUpdate(
            { roomName: data.room },
            { $push: { messages: msgObj } }
        );

        io.to(data.room).emit('chat-message', { room: data.room, name: sessionUser, message: data.message });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running smoothly on port ${PORT}`));