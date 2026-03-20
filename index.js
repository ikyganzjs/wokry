const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const FormData = require('form-data');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// KONFIGURASI DATABASE
// ============================================
const DB_FILE = path.join(__dirname, 'users.json');

// Init database
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/audio', express.static('public/audio'));
app.use('/pages', express.static('public/pages'));

// Multer config untuk upload file
const upload = multer({ 
    dest: 'uploads/', 
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipe file tidak didukung!'), false);
        }
    }
});

// Create uploads directory if not exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
const readDB = () => {
    try {
        const data = fs.readFileSync(DB_FILE);
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading DB:', error);
        return { users: [] };
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing DB:', error);
    }
};

// Reset daily limits
const resetDailyLimits = () => {
    const db = readDB();
    const today = new Date().toISOString().split('T')[0];
    let updated = false;
    
    db.users.forEach(user => {
        if (user.lastReset !== today) {
            user.limit = 50;
            user.lastReset = today;
            updated = true;
        }
    });
    
    if (updated) {
        writeDB(db);
        console.log('[IkyGPT] Daily limits reset completed');
    }
};

// Run daily reset at midnight
const scheduleDailyReset = () => {
    const now = new Date();
    const night = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const msToMidnight = night.getTime() - now.getTime();
    
    setTimeout(() => {
        resetDailyLimits();
        scheduleDailyReset(); // Schedule next day
    }, msToMidnight);
    
    console.log(`[IkyGPT] Next limit reset scheduled in ${Math.floor(msToMidnight / 1000 / 60)} minutes`);
};

// Start scheduler
scheduleDailyReset();

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register
app.post('/api/register', (req, res) => {
    const { username, password, email, umur, gender } = req.body;
    const db = readDB();
    
    // Validation
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
    
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username udah ada njir!' });
    }
    
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
    writeDB(db);
    
    res.json({ success: true, message: 'Daftar sukses! Silakan login.' });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Reset limit if new day
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

// Update profile
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
        
        writeDB(db);
        res.json({ success: true, message: 'Profile updated!' });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Check limit
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

// Use limit
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
        res.status(400).json({ error: 'Limit abis atau user tidak ditemukan!' });
    }
});

// Get user stats
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
    
    // Reset limit if new day
    const today = new Date().toISOString().split('T')[0];
    if (user.lastReset !== today) {
        user.limit = 50;
        user.lastReset = today;
        writeDB(db);
    }
    
    if (user.limit <= 0) {
        return res.status(403).json({ error: 'Limit habis hari ini! Kembali besok.' });
    }
    
    try {
        const result = await apiCall();
        user.limit--;
        user.totalUsage = (user.totalUsage || 0) + 1;
        writeDB(db);
        res.json(result);
    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ error: error.message || 'API Error, coba lagi nanti!' });
    }
};

// Roblox Stalk
app.get('/api/roblox', async (req, res) => {
    const { username: userReq, robloxUser } = req.query;
    if (!robloxUser) return res.status(400).json({ error: 'robloxUser parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/robloxstalk?apikey=IkyPrem&username=${encodeURIComponent(robloxUser)}`);
        return response.data;
    });
});

// TikTok Stalk
app.get('/api/tiktok-stalk', async (req, res) => {
    const { username: userReq, tiktokUser } = req.query;
    if (!tiktokUser) return res.status(400).json({ error: 'tiktokUser parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/stalk/tiktok?apikey=IkyPrem&username=${encodeURIComponent(tiktokUser)}`);
        return response.data;
    });
});

// BStation Search
app.get('/api/bstation', async (req, res) => {
    const { username: userReq, q } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/bstation?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        return response.data;
    });
});

// Pinterest Search
app.get('/api/pinterest', async (req, res) => {
    const { username: userReq, q } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/search/pinterest?apikey=IkyPrem&q=${encodeURIComponent(q)}`);
        return response.data;
    });
});

// CapCut Downloader
app.get('/api/capcut', async (req, res) => {
    const { username: userReq, url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/capcut?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

// Instagram Downloader
app.get('/api/instagram', async (req, res) => {
    const { username: userReq, url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/instagram?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

// TikTok Downloader
app.get('/api/tiktok-dl', async (req, res) => {
    const { username: userReq, url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    await withLimitCheck(req, res, async () => {
        const response = await axios.get(`https://api-cloudiky.vercel.app/download/tiktok?apikey=IkyPrem&url=${encodeURIComponent(url)}`);
        return response.data;
    });
});

// ============================================
// FILE UPLOAD ROUTES
// ============================================

// Catbox Upload
app.post('/api/upload-catbox', upload.single('file'), async (req, res) => {
    const { username } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check limit
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (!user) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'User tidak ditemukan!' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (user.lastReset !== today) {
        user.limit = 50;
        user.lastReset = today;
        writeDB(db);
    }
    
    if (user.limit <= 0) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Limit habis!' });
    }
    
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fs.createReadStream(req.file.path));
        
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 60000
        });
        
        // Cleanup temp file
        fs.unlinkSync(req.file.path);
        
        // Use limit
        user.limit--;
        user.totalUsage = (user.totalUsage || 0) + 1;
        writeDB(db);
        
        res.json({ 
            success: true, 
            url: response.data,
            filename: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload error:', error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Upload gagal: ' + error.message });
    }
});

// Alternative upload endpoint (simpler)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    const { username } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    
    if (!user || user.limit <= 0) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Limit habis atau user tidak valid!' });
    }
    
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fs.createReadStream(req.file.path));
        
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 60000
        });
        
        fs.unlinkSync(req.file.path);
        
        user.limit--;
        writeDB(db);
        
        res.json({ 
            success: true, 
            url: response.data,
            filename: req.file.originalname
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// ============================================
// SYSTEM STATUS
// ============================================

app.get('/api/status', (req, res) => {
    const db = readDB();
    const totalUsage = db.users.reduce((sum, user) => sum + (user.totalUsage || 0), 0);
    
    res.json({
        uptime: process.uptime(),
        platform: os.platform(),
        cpuLoad: os.loadavg(),
        memoryUsage: {
            rss: process.memoryUsage().rss,
            heapTotal: process.memoryUsage().heapTotal,
            heapUsed: process.memoryUsage().heapUsed,
            external: process.memoryUsage().external
        },
        totalUsers: db.users.length,
        totalUsage: totalUsage,
        status: "Online 🔥",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        nodeVersion: process.version
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
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
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║  🔥 IKYTOOLS SERVER IS RAGING! 🔥                         ║
    ║  📡 Port: ${PORT}                                            ║
    ║  👑 Owner: Iky                                            ║
    ║  💀 Mode: APOCALYPSE                                      ║
    ║  ⚡ Status: BRUTAL MODE ACTIVATED                         ║
    ╚══════════════════════════════════════════════════════════╝
    `);
    
    // Initial reset check
    resetDailyLimits();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[IkyGPT] Shutting down... 💀');
    process.exit(0);
});