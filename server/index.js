const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { generateSecurityReport, chatWithCopilot } = require('./aiSecurityBot');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("Neon Database connected successfully!"))
  .catch(err => console.error("Database Connection Error:", err));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// SYSTEM LOCKDOWN PROTOCOL (KILL SWITCH MIDDLEWARE)
// ==========================================
let SYSTEM_LOCKDOWN = false;
const checkLockdown = (req, res, next) => {
    if (SYSTEM_LOCKDOWN && !req.path.includes('/admin')) {
        return res.status(503).json({ 
            error: "SYSTEM LOCKDOWN ACTIVE", 
            message: "Zero Trust Protocol initiated. All connections severed. Contact Admin." 
        });
    }
    next();
};
app.use(checkLockdown);


// ==========================================
// Zero Trust AI Firewall 
// ==========================================
const loginBruteForceLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 3, 
    handler: async (req, res) => {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const targetEmail = req.body.email || "Unknown";
        
        console.log(`[SECURITY BREACH] DETECTED FROM IP: ${clientIp}`);
        const aiReport = await generateSecurityReport("Brute-Force / Credential Stuffing", clientIp, targetEmail);
        
        try {
            await pool.query(
                "INSERT INTO messages (sender_email, receiver_email, content) VALUES ($1, $2, $3)",
                ['ai_admin', targetEmail !== "Unknown" ? targetEmail : null, aiReport]
            );
        } catch (dbErr) {
            console.error("AI Alert save error:", dbErr);
        }
        res.status(429).json({ error: "Zero Trust Firewall: Security breach detected! Your IP is blocked." });
    }
});


// ==========================================
// SMART HONEYPOT ROUTE 
// ==========================================
app.get('/api/system/env-backup', async (req, res) => {
    try {
        const attackerIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log(`[HONEYPOT ALERT] Attack detected from IP: ${attackerIP}`);

        const aiReport = await generateSecurityReport("Unauthorized Directory Traversal / Honeypot Access", attackerIP, "Unknown");
        await pool.query(
            "INSERT INTO messages (sender_email, receiver_email, content) VALUES ($1, $2, $3)",
            ['ai_admin', null, aiReport]
        );

        res.status(403).json({
            status: "failed",
            error: "Access Denied",
            message: "Valid administrative token required to view system environment keys.",
            security_code: "ERR_AUTH_MISSING_0x892"
        });
    } catch (err) {
        console.error("Honeypot Error:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// ==========================================
// User Registration & Login (Auth)
// ==========================================
app.post('/register', async (req, res) => {
    try {
        const { username, email } = req.body;
        const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) return res.status(401).json({ error: "This email is already registered." });

        const newQuery = `INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id, username, email, status;`;
        const newUser = await pool.query(newQuery, [username, email]);
        res.status(201).json({ message: "Registration successful. Please wait for admin approval.", user: newUser.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/login', loginBruteForceLimiter, async (req, res) => {
    try {
        const { username, email, location } = req.body;
        if (location === "Location Denied" || location === "Geolocation not supported") {
            return res.status(403).json({ error: "Zero Trust Protocol: Location Access is mandatory." });
        }

        const userResult = await pool.query("SELECT * FROM users WHERE email = $1 AND username = $2", [email, username]);
        if (userResult.rows.length === 0) return res.status(401).json({ error: "Invalid Credentials." });
        
        const user = userResult.rows[0];
        if (user.status === 'pending') return res.status(403).json({ error: "Account pending approval." });
        if (user.is_locked) return res.status(403).json({ error: "Account locked. Contact Admin." });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await pool.query(
            "UPDATE users SET otp_code = $1, otp_expiry = NOW() + INTERVAL '5 minutes', last_login_location = $2 WHERE email = $3",
            [otpCode, location, email]
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Zero Trust Workspace - Login OTP",
            html: `<h2>Zero Trust Workspace</h2><p>Your OTP is: <b>${otpCode}</b> (Expires in 5m)</p>`
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent successfully." });
    } catch (err) {
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const userResult = await pool.query("SELECT *, (NOW() > otp_expiry) AS is_expired FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found." });
        
        const user = userResult.rows[0];
        if (user.otp_code !== otp) {
            await pool.query("UPDATE users SET otp_attempts = otp_attempts + 1 WHERE email = $1", [email]);
            return res.status(401).json({ error: "Invalid OTP." });
        }
        if (user.is_expired) return res.status(401).json({ error: "OTP has expired." });

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await pool.query(`
            UPDATE users 
            SET otp_attempts = 0, otp_code = NULL, otp_expiry = NULL, last_login_time = NOW(), last_login_ip = $1, session_active = TRUE
            WHERE email = $2
        `, [clientIp, email]);

        res.status(200).json({ message: "Login successful!", user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: "Server Error." });
    }
});


// ==========================================
// RESTORED: DASHBOARD USERS ROUTE
// ==========================================
app.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, username, email, session_active FROM users WHERE status = 'approved' ORDER BY username ASC"
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server Error." });
    }
});

// ==========================================
// RESTORED: MESSAGING ROUTES
// ==========================================
app.post('/messages', async (req, res) => {
    try {
        const { sender_email, receiver_email, content } = req.body;
        const result = await pool.query(
            "INSERT INTO messages (sender_email, receiver_email, content) VALUES ($1, $2, $3) RETURNING *",
            [sender_email, receiver_email, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Message send failed." });
    }
});

app.get('/messages/conversation/:email1/:email2', async (req, res) => {
    try {
        const { email1, email2 } = req.params;
        const result = await pool.query(`
            SELECT * FROM messages 
            WHERE (sender_email = $1 AND receiver_email = $2) 
               OR (sender_email = $2 AND receiver_email = $1)
            ORDER BY timestamp ASC
        `, [email1, email2]);
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch conversation." });
    }
});

app.get('/messages/global', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM messages WHERE receiver_email = 'global' ORDER BY timestamp ASC"
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch global messages." });
    }
});


// ==========================================
// Admin Actions (Include Force Logout & Lockdown)
// ==========================================
app.get('/admin/users', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, username, email, status, is_locked, session_active, otp_attempts, last_login_ip, last_login_time FROM users ORDER BY id ASC"
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/admin/user/action', async (req, res) => {
    try {
        const { email, action } = req.body;
        if (action === 'approve') await pool.query("UPDATE users SET status = 'approved' WHERE email = $1", [email]);
        else if (action === 'lock') await pool.query("UPDATE users SET is_locked = TRUE WHERE email = $1", [email]);
        else if (action === 'unlock') await pool.query("UPDATE users SET is_locked = FALSE, otp_attempts = 0 WHERE email = $1", [email]);
        else if (action === 'kick') await pool.query("UPDATE users SET session_active = FALSE WHERE email = $1", [email]);
        res.status(200).json({ message: `User account updated (${action}).` });
    } catch (err) {
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/admin/system/lockdown', async (req, res) => {
    try {
        const { state } = req.body;
        SYSTEM_LOCKDOWN = state;
        if(state) {
            await pool.query("UPDATE users SET session_active = FALSE");
            return res.status(200).json({ message: "SYSTEM LOCKDOWN ENGAGED. All nodes severed." });
        } else {
            return res.status(200).json({ message: "SYSTEM LOCKDOWN LIFTED. Normal operations resumed." });
        }
    } catch (err) {
        res.status(500).json({ error: "Lockdown execution failed." });
    }
});

app.post('/user/session/status', async (req, res) => {
    try {
        const { email } = req.body;
        if(SYSTEM_LOCKDOWN) return res.status(403).json({ valid: false, reason: "lockdown" });
        const user = await pool.query("SELECT session_active FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0 || !user.rows[0].session_active) {
            return res.status(403).json({ valid: false, reason: "kicked" });
        }
        res.status(200).json({ valid: true });
    } catch (err) {
        res.status(500).json({ error: "Server Error." });
    }
});

app.get('/admin/logs/messages', async (req, res) => { 
    try {
        const result = await pool.query("SELECT * FROM messages ORDER BY timestamp DESC");
        res.json(result.rows);
    } catch (e) { res.json([]); }
});

// ==========================================
// AI Security Copilot (WITH ADVANCED LOGIN ANALYZER)
// ==========================================
app.post('/admin/copilot/chat', async (req, res) => {
    try {
        const { message } = req.body;
        let finalPrompt = message;
        const userText = message.toLowerCase();
        
        if (userText.includes("login") || userText.includes("analyze") || userText.includes("user")) {
            const userLogs = await pool.query(
                "SELECT username, email, last_login_ip, last_login_time, otp_attempts, session_active FROM users ORDER BY last_login_time DESC LIMIT 5"
            );
            let analyzeText = "Recent user login activity from Database:\n";
            userLogs.rows.forEach(row => {
                analyzeText += `- User: ${row.username} (${row.email}) | IP: ${row.last_login_ip} | Active: ${row.session_active} | Failed OTPs: ${row.otp_attempts} | Last Seen: ${row.last_login_time}\n`;
            });
            finalPrompt = `Admin asks: "${message}". Act as a Senior Cyber Analyst. Review this raw database data: \n${analyzeText}\n Identify any anomalies (like high failed OTPs or unusual activity) and give a brief professional summary.`;
        } else if (userText.includes("report") || userText.includes("attack") || userText.includes("system")) {
            const recentAlerts = await pool.query(
                "SELECT content, timestamp FROM messages WHERE sender_email = 'ai_admin' ORDER BY timestamp DESC LIMIT 3"
            );
            if (recentAlerts.rows.length > 0) {
                let logsText = "Database Security Logs:\n";
                recentAlerts.rows.forEach(row => logsText += `[${row.timestamp}]: ${row.content}\n`);
                finalPrompt = `Admin asks: "${message}". Analyze these alerts: \n${logsText}\n Provide a brief incident response summary.`;
            } else {
                finalPrompt = `Admin asks: "${message}". Reply that system status is nominal and no recent honeypot triggers were found in the database.`;
            }
        }

        const aiResponse = await chatWithCopilot(finalPrompt);
        res.status(200).json({ response: aiResponse });
    } catch (err) {
        console.error("Copilot Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Zero Trust Backend running on port ${PORT}`);
});

module.exports = app;