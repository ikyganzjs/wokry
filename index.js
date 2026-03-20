const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// KONFIGURASI GITHUB GIST DATABASE
// ============================================
const GIST_ID = process.env.GIST_ID || '284da187b08cf9a3d289d1390e715551';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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';

// Validasi token
if (!GITHUB_TOKEN) {
    console.error('[ERROR] GITHUB_TOKEN not set!');
    console.error('Please add GITHUB_TOKEN to environment variables');
}

// Fungsi baca database dari GitHub Gist
async function readDB() {
    try {
        const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        const content = response.data.files['users.json']?.content || '{"users":[]}';
        return JSON.parse(content);
    } catch (error) {
        console.error('Read DB error:', error.response?.data || error.message);
        return { users: [] };
    }
}

// Fungsi write database ke GitHub Gist
async function writeDB(data) {
    try {
        const content = JSON.stringify(data, null, 2);
        
        await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
            files: {
                'users.json': {
                    content: content
                }
            }
        }, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        return true;
    } catch (error) {
        console.error('Write DB error:', error.response?.data || error.message);
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
// AUTHENTICATION ROUTES
// ============================================

// Register
app.post('/api/register', async (req, res) => {
    const { username, password, email, umur, gender } = req.body;
    
    // Validasi input
    if (!username || !password || !email || !umur || !gender) {
        return res.status(400).json({ error: 'Semua field harus diisi!' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username minimal 3 karakter!' });
    }
    
    if (password.length < 4) {
        return res.status(400).json({ error: 'Password minimal 4 karakter!' });
    }
    
    if (!email.includes('@')) {
        return res.status(400).json({ error: 'Email tidak valid!' });
    }
    
    const db = await readDB();
    
    // Cek username duplikat
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username udah ada njir!' });
    }
    
    // Cek email duplikat
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email sudah terdaftar!' });
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
    await writeDB(db);
    
    res.json({ success: true, message: 'Daftar sukses! Silakan login.' });
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Reset limit if new day
        const today = new Date().toISOString().split('T')[0];
        if (user.lastReset !== today) {
            user.limit = 50;
            user.lastReset = today;
            await writeDB(db);
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

// Update Profile
app.put('/api/update-profile', async (req, res) => {
    const { username, newName, newPassword, newEmail } = req.body;
    const db = await readDB();
    const userIndex = db.users.findIndex(u => u.username === username);
    
    if (userIndex !== -1) {
        if (newName && newName !== username) {
            if (db.users.find(u => u.username === newName)) {
                return res.status(400).json({ error: 'Username sudah dipakai!' });
            }
            db.users[userIndex].username = newName;
        }
        if (newPassword) {
            if (newPassword.length < 4) {
                return res.status(400).json({ error: 'Password minimal 4 karakter!' });
            }
            db.users[userIndex].password = newPassword;
        }
        if (newEmail) {
            if (!newEmail.includes('@')) {
                return res.status(400).json({ error: 'Email tidak valid!' });
            }
            if (db.users.find(u => u.email === newEmail && u.username !== username)) {
                return res.status(400).json({ error: 'Email sudah dipakai!' });
            }
            db.users[userIndex].email = newEmail;
        }
        
        await writeDB(db);
        res.json({ success: true, message: 'Profile updated!', newUsername: newName });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Check Limit
app.post('/api/check-limit', async (req, res) => {
    const { username } = req.body;
    const db = await readDB();
    const user = db.users.find(u => u.username === username);
    
    if (user) {
        const today = new Date().toISOString().split('T')[0];
        if (user.lastReset !== today) {
            user.limit = 50;
            user.lastReset = today;
            await writeDB(db);
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

// Use Limit
app.post('/api/use-limit', async (req, res) => {
    const { username } = req.body;
    const db = await readDB();
    const user = db.users.find(u => u.username === username);
    
    if (user && user.limit > 0) {
        user.limit--;
        user.totalUsage = (user.totalUsage || 0) + 1;
        await writeDB(db);
        res.json({ success: true, remaining: user.limit });
    } else {
        res.status(400).json({ error: 'Limit abis!' });
    }
});

// Get User Stats
app.get('/api/user-stats', async (req, res) => {
    const { username } = req.query;
    const db = await readDB();
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
// PROXY API DENGAN LIMIT CHECK
// ============================================

const withLimitCheck = async (req, res, apiCall) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    const db = await readDB();
    const user = db.users.find(u => u.username === username);
    if (!user) {
        return res.status(403).json({ error: 'User tidak ditemukan!' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (user.lastReset !== today) {
        user.limit = 50;
        user.lastReset = today;
        await writeDB(db);
    }
    
    if (user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis! Kembali besok.' });
    }
    
    try {
        const result = await apiCall();
        user.limit--;
        user.totalUsage = (user.totalUsage || 0) + 1;
        await writeDB(db);
        res.json(result);
    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ error: error.message || 'API Error, coba lagi nanti!' });
    }
};

// Roblox Stalk
app.get('/api/roblox', async (req, res) => {
    const { robloxUser } = req.query;
    if (!robloxUser) return res.status(400).json({ error: 'robloxUser parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/robloxstalk?apikey=IkyPrem&username=${encodeURIComponent(robloxUser)}`);
        return response.data;
    });
});

// TikTok Stalk
app.get('/api/tiktok-stalk', async (req, res) => {
    const { tiktokUser } = req.query;
    if (!tiktokUser) return res.status(400).json({ error: 'tiktokUser parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/stalk/tiktok?apikey=IkyPrem&username=${encodeURIComponent(tiktokUser)}`);
        return response.data;
    });
});

// BStation Search
app.get('/api/bstation', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/bstation?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        return response.data;
    });
});

// Pinterest Search
app.get('/api/pinterest', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/pinterest?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        return response.data;
    });
});

// CapCut Downloader
app.get('/api/capcut', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/capcut?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

// Instagram Downloader
app.get('/api/instagram', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/instagram?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

// TikTok Downloader
app.get('/api/tiktok-dl', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/tiktok?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

// Upload endpoint (via URL)
app.post('/api/upload', async (req, res) => {
    const { username, fileUrl } = req.body;
    
    if (!fileUrl) {
        return res.status(400).json({ error: 'fileUrl required' });
    }
    
    const db = await readDB();
    const user = db.users.find(u => u.username === username);
    
    if (!user) {
        return res.status(403).json({ error: 'User tidak ditemukan!' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (user.lastReset !== today) {
        user.limit = 50;
        user.lastReset = today;
        await writeDB(db);
    }
    
    if (user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        user.limit--;
        user.totalUsage = (user.totalUsage || 0) + 1;
        await writeDB(db);
        
        res.json({ 
            success: true, 
            url: fileUrl,
            message: 'Upload success! File URL saved.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SYSTEM STATUS
// ============================================

app.get('/api/status', async (req, res) => {
    const db = await readDB();
    const totalUsage = db.users.reduce((sum, user) => sum + (user.totalUsage || 0), 0);
    
    res.json({
        uptime: process.uptime(),
        platform: process.env.VERCEL ? 'vercel' : 'local',
        environment: process.env.VERCEL ? 'production' : 'development',
        totalUsers: db.users.length,
        totalUsage: totalUsage,
        status: "Online 🔥",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        database: "GitHub Gist"
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: GITHUB_TOKEN ? 'connected' : 'disconnected'
    });
});

// ============================================
// HTML ROUTES
// ============================================

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

app.get('/pages/:page', (req, res) => {
    const pagePath = path.join(__dirname, 'public', 'pages', `${req.params.page}.html`);
    if (fs.existsSync(pagePath)) {
        res.sendFile(pagePath);
    } else {
        res.status(404).send('Page not found');
    }
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
    const filePath = path.join(__dirname, 'public', '404.html');
    if (fs.existsSync(filePath)) {
        res.status(404).sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Page not found' });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
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
    ║  💀 Mode: APOCALYPSE                                      ║
    ║  🗄️  Database: GitHub Gist                                 ║
    ║  ⚡ Status: BRUTAL MODE ACTIVATED                         ║
    ╚══════════════════════════════════════════════════════════╝
        `);
    });
}

module.exports = app;