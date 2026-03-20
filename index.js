const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// KONFIGURASI DATABASE (JSONBIN.IO)
// ============================================
const JSONBIN_ID = process.env.JSONBIN_ID || '69bd69e0aa77b81da901f984';
const JSONBIN_KEY = process.env.JSONBIN_KEY || '$2a$10$TMTrWrI7Kh/jQpxzG.2C6.pcpiZgFjZMJdx2b.IR00B3qLxjgKXhG';

async function readDB() {
    try {
        if (!JSONBIN_KEY) return { users: [] };
        const response = await axios.get(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        return response.data.record;
    } catch (error) {
        console.error('Read DB error:', error.message);
        return { users: [] };
    }
}

async function writeDB(data) {
    try {
        if (!JSONBIN_KEY) return false;
        await axios.put(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}`, data, {
            headers: {
                'X-Master-Key': JSONBIN_KEY,
                'Content-Type': 'application/json'
            }
        });
        return true;
    } catch (error) {
        console.error('Write DB error:', error.message);
        return false;
    }
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ============================================
// ROUTE HTML - SETIAP HALAMAN PUNYA ENDPOINT SENDIRI
// ============================================

// Halaman Utama
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Halaman Login
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Halaman Daftar
app.get("/daftar", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "daftar.html"));
});

// Halaman Dashboard
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ============================================
// HALAMAN FITUR (MASING-MASING ADA ROUTE SENDIRI)
// ============================================

// Roblox Stalker
app.get("/roblox", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "roblox.html"));
});

// TikTok Stalker
app.get("/tiktok-stalk", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "tiktok-stalk.html"));
});

// BStation Search
app.get("/bstation", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "bstation.html"));
});

// Pinterest Downloader
app.get("/pinterest", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "pinterest.html"));
});

// CapCut Downloader
app.get("/capcut", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "capcut.html"));
});

// Instagram Downloader
app.get("/instagram", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "instagram.html"));
});

// TikTok Downloader
app.get("/tiktok-dl", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "tiktok-dl.html"));
});

// Upload File
app.get("/upload", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "upload.html"));
});

// System Status
app.get("/status", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "status.html"));
});

// ============================================
// API ENDPOINTS (BUAT PROSES DATA)
// ============================================

// Register API
app.post('/api/register', async (req, res) => {
    const { username, password, email, umur, gender } = req.body;
    
    if (!username || !password || !email || !umur || !gender) {
        return res.status(400).json({ error: 'Semua field harus diisi!' });
    }
    
    const db = await readDB();
    
    if (db.users && db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username udah ada njir!' });
    }
    
    const newUser = {
        id: Date.now(),
        username,
        password,
        email,
        umur: parseInt(umur),
        gender,
        limit: 50,
        lastReset: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        totalUsage: 0
    };
    
    if (!db.users) db.users = [];
    db.users.push(newUser);
    await writeDB(db);
    
    res.json({ success: true, message: 'Daftar sukses! Silakan login.' });
});

// Login API
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username && u.password === password) : null;
    
    if (user) {
        const today = new Date().toISOString().split('T')[0];
        if (user.lastReset !== today) {
            user.limit = 50;
            user.lastReset = today;
            await writeDB(db);
        }
        
        res.json({ 
            success: true, 
            user: {
                username: user.username,
                email: user.email,
                umur: user.umur,
                gender: user.gender,
                limit: user.limit,
                avatar: user.username.charAt(0).toUpperCase()
            }
        });
    } else {
        res.status(401).json({ error: 'Username/password salah njir!' });
    }
});

// Update Profile API
app.put('/api/update-profile', async (req, res) => {
    const { username, newName, newPassword, newEmail } = req.body;
    const db = await readDB();
    const userIndex = db.users.findIndex(u => u.username === username);
    
    if (userIndex !== -1) {
        if (newName) db.users[userIndex].username = newName;
        if (newPassword) db.users[userIndex].password = newPassword;
        if (newEmail) db.users[userIndex].email = newEmail;
        
        await writeDB(db);
        res.json({ success: true, message: 'Profile updated!' });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Check Limit API
app.post('/api/check-limit', async (req, res) => {
    const { username } = req.body;
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    
    if (user && user.limit > 0) {
        res.json({ allowed: true, limit: user.limit });
    } else {
        res.json({ allowed: false, message: 'Limit habis! Tunggu besok lagi.' });
    }
});

// Use Limit API
app.post('/api/use-limit', async (req, res) => {
    const { username } = req.body;
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    
    if (user && user.limit > 0) {
        user.limit--;
        await writeDB(db);
        res.json({ success: true, remaining: user.limit });
    } else {
        res.status(400).json({ error: 'Limit abis!' });
    }
});

// ============================================
// API PROXY UNTUK FITUR-FITUR
// ============================================

// Roblox API
app.get('/api/roblox', async (req, res) => {
    const { username, robloxUser } = req.query;
    if (!robloxUser) return res.status(400).json({ error: 'robloxUser required' });
    
    // Check limit dulu
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const response = await axios.get(`https://api-cloudiky.vercel.app/robloxstalk?apikey=IkyPrem&username=${encodeURIComponent(robloxUser)}`);
        
        // Kurangi limit
        user.limit--;
        await writeDB(db);
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// TikTok Stalk API
app.get('/api/tiktok-stalk', async (req, res) => {
    const { username, tiktokUser } = req.query;
    if (!tiktokUser) return res.status(400).json({ error: 'tiktokUser required' });
    
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const response = await axios.get(`https://api-cloudiky.vercel.app/stalk/tiktok?apikey=IkyPrem&username=${encodeURIComponent(tiktokUser)}`);
        user.limit--;
        await writeDB(db);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// BStation API
app.get('/api/bstation', async (req, res) => {
    const { username, q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/bstation?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        user.limit--;
        await writeDB(db);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pinterest API
app.get('/api/pinterest', async (req, res) => {
    const { username, q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/pinterest?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        user.limit--;
        await writeDB(db);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CapCut API
app.get('/api/capcut', async (req, res) => {
    const { username, url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/capcut?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        user.limit--;
        await writeDB(db);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Instagram API
app.get('/api/instagram', async (req, res) => {
    const { username, url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/instagram?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        user.limit--;
        await writeDB(db);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// TikTok Downloader API
app.get('/api/tiktok-dl', async (req, res) => {
    const { username, url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    
    const db = await readDB();
    const user = db.users ? db.users.find(u => u.username === username) : null;
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/tiktok?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        user.limit--;
        await writeDB(db);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System Status API
app.get('/api/status', async (req, res) => {
    const db = await readDB();
    res.json({
        uptime: process.uptime(),
        platform: process.env.VERCEL ? 'vercel' : 'local',
        totalUsers: db.users ? db.users.length : 0,
        status: "Online 🔥",
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    res.status(404).send(`
        <h1>404 - Halaman Tidak Ditemukan!</h1>
        <p>Yang lu cari gak ada njir! 💀</p>
        <a href="/">Kembali ke Login</a>
    `);
});

// ============================================
// START SERVER
// ============================================
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║  🔥 IKYTOOLS SERVER IS RAGING! 🔥                         ║
    ║  📡 Port: ${PORT}                                            ║
    ║  👑 Owner: Iky                                            ║
    ║  📍 Routes:                                               ║
    ║     - /login      : Halaman Login                         ║
    ║     - /daftar     : Halaman Daftar                        ║
    ║     - /dashboard  : Halaman Dashboard                     ║
    ║     - /roblox     : Roblox Stalker                        ║
    ║     - /tiktok-stalk : TikTok Stalker                      ║
    ║     - /bstation   : BStation Search                       ║
    ║     - /pinterest  : Pinterest Downloader                  ║
    ║     - /capcut     : CapCut Downloader                     ║
    ║     - /instagram  : Instagram Downloader                  ║
    ║     - /tiktok-dl  : TikTok Downloader                     ║
    ║     - /upload     : Upload File                           ║
    ║     - /status     : System Status                         ║
    ║  ⚡ Status: BRUTAL MODE ACTIVATED                         ║
    ╚══════════════════════════════════════════════════════════╝
        `);
    });
}

module.exports = app;