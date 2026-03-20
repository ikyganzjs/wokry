const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// VERCEL COMPATIBLE - FIXED ROUTING
// ============================================

// In-memory database
let usersDB = { users: [] };

if (process.env.USERS_DATA) {
    try {
        usersDB = JSON.parse(process.env.USERS_DATA);
    } catch(e) {}
}

const readDB = () => usersDB;
const writeDB = (data) => {
    usersDB = data;
};

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Serve static files FIRST before API routes
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/register', (req, res) => {
    const { username, password, email, umur, gender } = req.body;
    const db = readDB();
    
    if (!username || !password || !email || !umur || !gender) {
        return res.status(400).json({ error: 'Semua field harus diisi!' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username minimal 3 karakter!' });
    }
    
    if (password.length < 4) {
        return res.status(400).json({ error: 'Password minimal 4 karakter!' });
    }
    
    if (db.users.find(u => u.username === username)) {
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
    
    db.users.push(newUser);
    writeDB(db);
    
    res.json({ success: true, message: 'Daftar sukses! Silakan login.' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const today = new Date().toISOString().split('T')[0];
        if (user.lastReset !== today) {
            user.limit = 50;
            user.lastReset = today;
            writeDB(db);
        }
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                umur: user.umur,
                gender: user.gender,
                limit: user.limit,
                avatar: user.username.charAt(0).toUpperCase(),
                totalUsage: user.totalUsage || 0
            }
        });
    } else {
        res.status(401).json({ error: 'Username/password salah njir!' });
    }
});

app.put('/api/update-profile', (req, res) => {
    const { username, newName, newPassword, newEmail } = req.body;
    const db = readDB();
    const userIndex = db.users.findIndex(u => u.username === username);
    
    if (userIndex !== -1) {
        if (newName && newName !== username) {
            if (db.users.find(u => u.username === newName)) {
                return res.status(400).json({ error: 'Username sudah dipakai!' });
            }
            db.users[userIndex].username = newName;
        }
        if (newPassword) db.users[userIndex].password = newPassword;
        if (newEmail) db.users[userIndex].email = newEmail;
        
        writeDB(db);
        res.json({ success: true, message: 'Profile updated!', newUsername: newName });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.post('/api/check-limit', (req, res) => {
    const { username } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (user) {
        const today = new Date().toISOString().split('T')[0];
        if (user.lastReset !== today) {
            user.limit = 50;
            user.lastReset = today;
            writeDB(db);
        }
        
        if (user.limit > 0) {
            res.json({ allowed: true, limit: user.limit });
        } else {
            res.json({ allowed: false, message: 'Limit habis! Tunggu besok lagi.' });
        }
    } else {
        res.json({ allowed: false, message: 'User tidak ditemukan!' });
    }
});

app.post('/api/use-limit', (req, res) => {
    const { username } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (user && user.limit > 0) {
        user.limit--;
        user.totalUsage = (user.totalUsage || 0) + 1;
        writeDB(db);
        res.json({ success: true, remaining: user.limit });
    } else {
        res.status(400).json({ error: 'Limit abis!' });
    }
});

app.get('/api/user-stats', (req, res) => {
    const { username } = req.query;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (user) {
        res.json({
            username: user.username,
            email: user.email,
            umur: user.umur,
            gender: user.gender,
            limit: user.limit,
            totalUsage: user.totalUsage || 0,
            joined: user.createdAt,
            avatar: user.username.charAt(0).toUpperCase()
        });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// ============================================
// PROXY API WITH LIMIT CHECK
// ============================================

const withLimitCheck = async (req, res, apiCall) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user) {
        return res.status(403).json({ error: 'User tidak ditemukan!' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (user.lastReset !== today) {
        user.limit = 50;
        user.lastReset = today;
        writeDB(db);
    }
    
    if (user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis! Kembali besok.' });
    }
    
    try {
        const result = await apiCall();
        user.limit--;
        user.totalUsage = (user.totalUsage || 0) + 1;
        writeDB(db);
        res.json(result);
    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ error: error.message || 'API Error!' });
    }
};

app.get('/api/roblox', async (req, res) => {
    const { robloxUser } = req.query;
    if (!robloxUser) return res.status(400).json({ error: 'robloxUser required' });
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/robloxstalk?apikey=IkyPrem&username=${encodeURIComponent(robloxUser)}`);
        return response.data;
    });
});

app.get('/api/tiktok-stalk', async (req, res) => {
    const { tiktokUser } = req.query;
    if (!tiktokUser) return res.status(400).json({ error: 'tiktokUser required' });
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/stalk/tiktok?apikey=IkyPrem&username=${encodeURIComponent(tiktokUser)}`);
        return response.data;
    });
});

app.get('/api/bstation', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/bstation?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        return response.data;
    });
});

app.get('/api/pinterest', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/pinterest?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        return response.data;
    });
});

app.get('/api/capcut', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/capcut?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

app.get('/api/instagram', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/instagram?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

app.get('/api/tiktok-dl', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/tiktok?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

app.post('/api/upload', async (req, res) => {
    const { username, fileUrl } = req.body;
    
    if (!fileUrl) {
        return res.status(400).json({ error: 'fileUrl required' });
    }
    
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (!user || user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        user.limit--;
        writeDB(db);
        res.json({ 
            success: true, 
            url: fileUrl,
            message: 'Upload success!'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    const db = readDB();
    const totalUsage = db.users.reduce((sum, user) => sum + (user.totalUsage || 0), 0);
    
    res.json({
        uptime: process.uptime(),
        platform: 'vercel',
        environment: process.env.VERCEL ? 'production' : 'development',
        totalUsers: db.users.length,
        totalUsage: totalUsage,
        status: "Online 🔥",
        timestamp: new Date().toISOString(),
        version: "2.0.0"
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL ? 'vercel' : 'local'
    });
});

// ============================================
// HTML ROUTES - CRITICAL FIX!
// ============================================

// Serve HTML files directly from public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/daftar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'daftar.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve pages from pages folder
app.get('/pages/:page', (req, res) => {
    const pagePath = path.join(__dirname, 'public', 'pages', `${req.params.page}.html`);
    res.sendFile(pagePath);
});

// ============================================
// 404 HANDLER - MUST BE LAST
// ============================================

app.use((req, res) => {
    // Check if requested file exists in public
    const filePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }
    // If not found, send 404 page
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Add fs for checking files
const fs = require('fs');

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
});

// Export for Vercel
module.exports = app;

// Only listen if not on Vercel
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[IkyGPT] Server running on port ${PORT} 🔥`);
        console.log(`📍 Login: http://localhost:${PORT}/login`);
        console.log(`📍 Daftar: http://localhost:${PORT}/daftar`);
    });
}