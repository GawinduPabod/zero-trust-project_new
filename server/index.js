// ==========================================
// SECTION 1: IMPORTS & DATABASE CONNECTION
// ==========================================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { generateSecurityReport, chatWithCopilot } = require('./aiSecurityBot');

const app = express();

// ==========================================
// NEW: FIXED CORS CONFIGURATION
// ==========================================
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20, 
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 2000, 
});

pool.connect()
  .then(() => console.log("Neon Database connected successfully!"))
  .catch(err => console.error("Database Connection Error:", err));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ==========================================
// SECTION 2: HIGH TRAFFIC & SECURITY CONTROLS
// ==========================================
const globalTrafficLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 150, 
    message: { 
        error: "System is experiencing high traffic.", 
        message: "Zero Trust Protocol: Too many requests. Please try again in a minute." 
    }
});
app.use(globalTrafficLimiter);

let SYSTEM_LOCKDOWN = false;
const checkLockdown = (req, res, next) => {
    if (SYSTEM_LOCKDOWN && !req.path.includes('/admin')) {
        return res.status(503).json({ error: "SYSTEM LOCKDOWN ACTIVE", message: "Zero Trust Protocol initiated." });
    }
    next();
};
app.use(checkLockdown);

const loginBruteForceLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, max: 3, 
    handler: async (req, res) => {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const targetEmail = req.body.email || "Unknown";
        const aiReport = await generateSecurityReport("Brute-Force", clientIp, targetEmail);
        try {
            const receiver = targetEmail !== "Unknown" ? targetEmail : 'zerotrust.admin@gmail.com';
            await pool.query("INSERT INTO messages (sender_email, receiver_email, content) VALUES ($1, $2, $3)", ['ai_admin', receiver, aiReport]);
        } catch (dbErr) {}
        res.status(429).json({ error: "Security breach detected! IP blocked." });
    }
});

// ==========================================
// SECTION 3: AUTHENTICATION (REGISTER / LOGIN / OTP)
// ==========================================
app.post('/register', async (req, res) => {
    try {
        const { username, email } = req.body;
        const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) return res.status(401).json({ error: "Email already registered." });
        const newUser = await pool.query("INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id, username, email, status;", [username, email]);
        res.status(201).json({ message: "Registration successful.", user: newUser.rows[0] });
    } catch (err) { res.status(500).json({ error: "Server Error." }); }
});

app.post('/login', loginBruteForceLimiter, async (req, res) => {
    try {
        const { username, email, location } = req.body;
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1 AND username = $2", [email, username]);
        if (userResult.rows.length === 0) return res.status(401).json({ error: "Invalid Credentials." });
        
        const user = userResult.rows[0];
        if (user.status === 'pending') return res.status(403).json({ error: "Account pending approval." });
        if (user.is_locked) return res.status(403).json({ error: "Account is locked." });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await pool.query("UPDATE users SET otp_code = $1, otp_expiry = NOW() + INTERVAL '5 minutes', last_login_location = $2 WHERE email = $3", [otpCode, location, email]);

        const mailOptions = { 
            from: '"Zero Trust Security" <' + process.env.EMAIL_USER + '>', 
            to: email, 
            subject: "Zero Trust - Login OTP", 
            html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                <h2 style="color: #005c4b;">Zero Trust Workspace</h2>
                <p>Your secure One-Time Password (OTP) for login is:</p>
                <h1 style="color: #333; letter-spacing: 2px;">${otpCode}</h1>
                <p style="color: #777; font-size: 12px;">This code will expire in 5 minutes. Do not share it with anyone.</p>
            </div>
            ` 
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent successfully." });
    } catch (err) { res.status(500).json({ error: "Server Error." }); }
});

app.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "Unknown IP";
        
        const userResult = await pool.query("SELECT *, (NOW() > otp_expiry) AS is_expired FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found." });
        
        const user = userResult.rows[0];
        if (user.is_locked) return res.status(403).json({ error: "Account locked." });

        if (user.otp_code !== otp) {
            const currentAttempts = (user.otp_attempts || 0) + 1;
            
            if (currentAttempts >= 4) {
                await pool.query("UPDATE users SET is_locked = TRUE, otp_attempts = $1 WHERE email = $2", [currentAttempts, email]);
                
                const alertMessage = `[SECURITY ALERT] ACCOUNT AUTOLOCKED\nTarget Email: ${email}\nSource IP: ${clientIp}\nReason: Maximum failed OTP attempts (4/4) reached. Account has been disabled to prevent unauthorized access.`;
                try {
                    await pool.query("INSERT INTO messages (sender_email, receiver_email, content) VALUES ($1, $2, $3)", ['ai_admin', 'zerotrust.admin@gmail.com', alertMessage]);
                } catch (dbErr) { console.error(dbErr); }

                return res.status(403).json({ error: "Account locked due to 4 failed OTP attempts." });
            } else {
                await pool.query("UPDATE users SET otp_attempts = $1 WHERE email = $2", [currentAttempts, email]);
                return res.status(401).json({ error: `Invalid OTP. ${4 - currentAttempts} attempts remaining.` });
            }
        }

        if (user.is_expired) return res.status(401).json({ error: "OTP expired." });

        await pool.query("UPDATE users SET otp_attempts = 0, otp_code = NULL, otp_expiry = NULL, last_login_time = NOW(), last_login_ip = $1, session_active = TRUE WHERE email = $2", [clientIp, email]);
        
        res.status(200).json({ message: "Login successful!", user });
    } catch (err) { res.status(500).json({ error: "Server Error." }); }
});

// ==========================================
// SECTION 4: FETCH APPROVED USERS
// ==========================================
app.get('/users/approved', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE status = 'approved' ORDER BY username ASC");
        res.status(200).json(result.rows);
    } catch (err) { res.status(500).json({ error: "Server Error." }); }
});

// ==========================================
// SECTION 5: MESSAGING SYSTEM
// ==========================================
app.post('/messages/send', async (req, res) => {
    try {
        const { sender_email, receiver_email, content } = req.body;
        const result = await pool.query("INSERT INTO messages (sender_email, receiver_email, content) VALUES ($1, $2, $3) RETURNING *", [sender_email, receiver_email, content]);
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Message send failed." }); }
});

app.post('/messages/get', async (req, res) => {
    try {
        const { email, chat_with } = req.body;
        let result;
        if (chat_with === 'global' || !chat_with) {
            result = await pool.query("SELECT * FROM messages WHERE (receiver_email IS NULL OR receiver_email = 'global') AND sender_email != 'ai_admin' ORDER BY timestamp ASC");
        } else if (chat_with === 'ai_admin' || chat_with === 'zerotrust.admin@gmail.com') {
            result = await pool.query("SELECT * FROM messages WHERE (sender_email = $1 AND receiver_email = $2) OR (sender_email = $2 AND receiver_email = $1) ORDER BY timestamp ASC", [email, chat_with]);
        } else {
            result = await pool.query("SELECT * FROM messages WHERE (sender_email = $1 AND receiver_email = $2) OR (sender_email = $2 AND receiver_email = $1) ORDER BY timestamp ASC", [email, chat_with]);
        }
        res.status(200).json(result.rows);
    } catch (err) { res.status(500).json({ error: "Failed to fetch conversation." }); }
});

// ==========================================
// SECTION 6: SECURE FILE TRANSFER
// ==========================================
app.post('/files/upload', async (req, res) => {
    try {
        const { sender_email, receiver_email, file_name, file_data } = req.body;
        const result = await pool.query("INSERT INTO files (sender_email, receiver_email, file_name, file_data) VALUES ($1, $2, $3, $4) RETURNING *", [sender_email, receiver_email, file_name, file_data]);
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "File upload failed." }); }
});

app.post('/files/list', async (req, res) => {
    try {
        const { email, chat_with } = req.body;
        let result;
        if (chat_with === 'global') {
            result = await pool.query("SELECT id, sender_email, receiver_email, file_name, timestamp FROM files WHERE receiver_email IS NULL OR receiver_email = 'global' ORDER BY timestamp ASC");
        } else {
            result = await pool.query("SELECT id, sender_email, receiver_email, file_name, timestamp FROM files WHERE (sender_email = $1 AND receiver_email = $2) OR (sender_email = $2 AND receiver_email = $1) ORDER BY timestamp ASC", [email, chat_with]);
        }
        res.status(200).json(result.rows);
    } catch (err) { res.status(500).json({ error: "Failed to fetch files." }); }
});

app.post('/files/request-otp', async (req, res) => {
    try {
        const { file_id, receiver_email } = req.body;
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await pool.query("UPDATE users SET otp_code = $1, otp_expiry = NOW() + INTERVAL '5 minutes' WHERE email = $2", [otpCode, receiver_email]);
        
        const mailOptions = {
            from: '"Zero Trust Security" <' + process.env.EMAIL_USER + '>',
            to: receiver_email,
            subject: "Secure File Download OTP",
            html: `<p>Your OTP to unlock this file is: <b>${otpCode}</b></p>`
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent" });
    } catch (err) { res.status(500).json({ error: "OTP request failed." }); }
});

app.post('/files/download', async (req, res) => {
    try {
        const { file_id, otp } = req.body;
        const userResult = await pool.query("SELECT * FROM users WHERE otp_code = $1 AND NOW() <= otp_expiry", [otp]);
        if(userResult.rows.length === 0) return res.status(401).json({ error: "Invalid or expired OTP." });
        
        await pool.query("UPDATE users SET otp_code = NULL WHERE id = $1", [userResult.rows[0].id]);
        const fileResult = await pool.query("SELECT * FROM files WHERE id = $1", [file_id]);
        res.status(200).json(fileResult.rows[0]);
    } catch (err) { res.status(500).json({ error: "Download failed." }); }
});

app.post('/user/profile-pic', async (req, res) => {
    try {
        const { email, profilePicture } = req.body;
        await pool.query("UPDATE users SET profile_picture = $1 WHERE email = $2", [profilePicture, email]);
        res.status(200).json({ message: "Profile picture updated" });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ==========================================
// SECTION 7: ADMIN CONTROLS
// ==========================================
app.get('/admin/users', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
        // FIX: Removed the 'a' typo here
        res.status(200).json(result.rows);
    } catch (err) { res.status(500).json({ error: "Server Error." }); }
});

// FIX: Re-added missing admin user action route
app.post('/admin/user/action', async (req, res) => {
    try {
        const { email, action } = req.body;
        if (action === 'approve') await pool.query("UPDATE users SET status = 'approved' WHERE email = $1", [email]);
        else if (action === 'lock') await pool.query("UPDATE users SET is_locked = TRUE WHERE email = $1", [email]);
        else if (action === 'unlock') await pool.query("UPDATE users SET is_locked = FALSE, otp_attempts = 0 WHERE email = $1", [email]);
        else if (action === 'kick') await pool.query("UPDATE users SET session_active = FALSE WHERE email = $1", [email]);
        res.status(200).json({ message: `User updated.` });
    } catch (err) { res.status(500).json({ error: "Server Error." }); }
});

app.post('/admin/system/lockdown', async (req, res) => {
    try {
        const { state } = req.body;
        SYSTEM_LOCKDOWN = state;
        if(state) await pool.query("UPDATE users SET session_active = FALSE");
        res.status(200).json({ message: state ? "LOCKDOWN ENGAGED" : "LOCKDOWN LIFTED" });
    } catch (err) { res.status(500).json({ error: "Failed." }); }
});

app.post('/admin/copilot/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const aiResponse = await chatWithCopilot(message);
        res.status(200).json({ response: aiResponse });
    } catch (err) { res.status(500).json({ error: "Server Error." }); }
});

app.get('/admin/logs/messages', async (req, res) => { 
    try {
        const result = await pool.query("SELECT * FROM messages ORDER BY timestamp DESC");
        res.json(result.rows);
    } catch (e) { res.json([]); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Zero Trust Backend running on port ${PORT}`));
module.exports = app;