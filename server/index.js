const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database connection setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("Neon Database connected successfully!"))
  .catch(err => console.error("Database Connection Error:", err));


// Nodemailer Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// ==========================================
// User Registration Section
// ==========================================
app.post('/register', async (req, res) => {
    try {
        const { username, email } = req.body;
        const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        
        if (userExists.rows.length > 0) {
            return res.status(401).json({ error: "This email is already registered." });
        }

        const newQuery = `INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id, username, email, status;`;
        const newUser = await pool.query(newQuery, [username, email]);

        res.status(201).json({ 
            message: "Registration successful. Please wait for admin approval.", 
            user: newUser.rows[0] 
        });
    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).json({ error: "Server Error. Please try again." });
    }
});


// ==========================================
// Login & Generate OTP Section 
// ==========================================
app.post('/login', async (req, res) => {
    try {
        const { username, email } = req.body;
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1 AND username = $2", [email, username]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: "Invalid Username or Email." });
        }

        const user = userResult.rows[0];

        if (user.status === 'pending') {
            return res.status(403).json({ error: "Your account is not approved by the Admin yet." });
        }
        if (user.is_locked) {
            return res.status(403).json({ error: "Your account is locked. Please contact Admin." });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        await pool.query(
            "UPDATE users SET otp_code = $1, otp_expiry = NOW() + INTERVAL '5 minutes' WHERE email = $2",
            [otpCode, email]
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Zero Trust Workspace - Login OTP",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Zero Trust Workspace</h2>
                    <p>Hello ${username},</p>
                    <p>Your One-Time Password (OTP) for login is:</p>
                    <h1 style="color: #0056b3; letter-spacing: 2px;">${otpCode}</h1>
                    <p style="color: red; font-size: 12px;">This code will expire in 5 minutes.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent to your email successfully." });

    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).json({ error: "Server Error. Please try again." });
    }
});


// ==========================================
// Verify OTP & Login Section 
// ==========================================
app.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        const userResult = await pool.query(
            "SELECT *, (NOW() > otp_expiry) AS is_expired FROM users WHERE email = $1", 
            [email]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = userResult.rows[0];

        if (user.otp_code !== otp) {
            await pool.query("UPDATE users SET otp_attempts = otp_attempts + 1 WHERE email = $1", [email]);
            const updatedUserResult = await pool.query("SELECT otp_attempts FROM users WHERE email = $1", [email]);
            const attempts = updatedUserResult.rows[0].otp_attempts;

            if (attempts >= 4) {
                await pool.query("UPDATE users SET is_locked = TRUE WHERE email = $1", [email]);
                return res.status(403).json({ error: "Account locked due to too many invalid attempts. Contact Admin." });
            }
            return res.status(401).json({ error: `Invalid OTP. Attempts left: ${4 - attempts}` });
        }

        if (user.is_expired) {
            return res.status(401).json({ error: "OTP has expired. Please request a new one." });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        await pool.query(`
            UPDATE users 
            SET otp_attempts = 0, otp_code = NULL, otp_expiry = NULL, last_login_time = NOW(), last_login_ip = $1
            WHERE email = $2
        `, [clientIp, email]);

        res.status(200).json({ 
            message: "Login successful! Redirecting to Dashboard", 
            user: { id: user.id, username: user.username, email: user.email } 
        });

    } catch (err) {
        console.error("OTP Verification Error:", err.message);
        res.status(500).json({ error: "Server Error. Please try again." });
    }
});


// ==========================================
// Admin Dashboard Endpoints
// ==========================================

app.get('/admin/users', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, username, email, status, is_locked, otp_attempts, last_login_ip, last_login_time FROM users ORDER BY id ASC"
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Admin Fetch Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/admin/user/action', async (req, res) => {
    try {
        const { email, action } = req.body;
        
        if (action === 'approve') {
            await pool.query("UPDATE users SET status = 'approved' WHERE email = $1", [email]);
        } else if (action === 'lock') {
            await pool.query("UPDATE users SET is_locked = TRUE WHERE email = $1", [email]);
        } else if (action === 'unlock') {
            await pool.query("UPDATE users SET is_locked = FALSE, otp_attempts = 0 WHERE email = $1", [email]);
        }
        
        res.status(200).json({ message: `User account successfully updated (${action}).` });
    } catch (err) {
        console.error("Admin Action Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.get('/admin/logs/files', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, sender_email, receiver_email, file_name, timestamp FROM files ORDER BY timestamp DESC"
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Admin File Logs Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.get('/admin/logs/messages', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, sender_email, receiver_email, timestamp FROM messages ORDER BY timestamp DESC"
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Admin Message Logs Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});


// ==========================================
// User Dashboard & Profile Section
// ==========================================

app.get('/users/approved', async (req, res) => {
    try {
        const result = await pool.query("SELECT username, email, profile_picture FROM users WHERE status = 'approved'");
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Fetch Users Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/user/profile-pic', async (req, res) => {
    try {
        const { email, profilePicture } = req.body;
        await pool.query("UPDATE users SET profile_picture = $1 WHERE email = $2", [profilePicture, email]);
        res.status(200).json({ message: "Profile picture updated successfully." });
    } catch (err) {
        console.error("Profile Update Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});


// ==========================================
// Messaging Section 
// ==========================================

app.post('/messages/send', async (req, res) => {
    try {
        const { sender_email, receiver_email, content } = req.body;
        await pool.query(
            "INSERT INTO messages (sender_email, receiver_email, content) VALUES ($1, $2, $3)",
            [sender_email, receiver_email || null, content]
        );
        res.status(200).json({ message: "Message sent." });
    } catch (err) {
        console.error("Send Message Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/messages/get', async (req, res) => {
    try {
        const { email, chat_with } = req.body;
        let result;
        
        if (chat_with === 'global') {
            result = await pool.query("SELECT * FROM messages WHERE receiver_email IS NULL ORDER BY timestamp ASC");
        } else {
            result = await pool.query(
                "SELECT * FROM messages WHERE (sender_email = $1 AND receiver_email = $2) OR (sender_email = $2 AND receiver_email = $1) ORDER BY timestamp ASC",
                [email, chat_with]
            );
        }
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Get Messages Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});


// ==========================================
// Secure File Transfer Section
// ==========================================

app.post('/files/upload', async (req, res) => {
    try {
        const { sender_email, receiver_email, file_name, file_data } = req.body;
        await pool.query(
            "INSERT INTO files (sender_email, receiver_email, file_name, file_data) VALUES ($1, $2, $3, $4)",
            [sender_email, receiver_email || null, file_name, file_data]
        );
        res.status(200).json({ message: "Encrypted file uploaded successfully." });
    } catch (err) {
        console.error("File Upload Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/files/request-otp', async (req, res) => {
    try {
        const { file_id, receiver_email } = req.body;
        
        const fileResult = await pool.query("SELECT * FROM files WHERE id = $1 AND (receiver_email = $2 OR receiver_email IS NULL)", [file_id, receiver_email]);
        if (fileResult.rows.length === 0) return res.status(404).json({ error: "File not found or access denied." });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        await pool.query(
            "UPDATE files SET download_otp = $1, otp_expiry = NOW() + INTERVAL '5 minutes' WHERE id = $2",
            [otpCode, file_id]
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: receiver_email,
            subject: "Secure File Download - OTP",
            html: `
                <div style="font-family: Arial; padding: 20px;">
                    <h2>File Download Authorization</h2>
                    <p>You requested to download a secure file (${fileResult.rows[0].file_name}).</p>
                    <p>Your OTP to decrypt and download is: <b style="font-size: 24px; color: blue;">${otpCode}</b></p>
                    <p>Expires in 5 minutes.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent to your email for file decryption." });

    } catch (err) {
        console.error("File OTP Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/files/download', async (req, res) => {
    try {
        const { file_id, otp } = req.body;
        
        const fileResult = await pool.query(
            "SELECT *, (NOW() > otp_expiry) AS is_expired FROM files WHERE id = $1", 
            [file_id]
        );
        
        if (fileResult.rows.length === 0) return res.status(404).json({ error: "File not found." });
        const file = fileResult.rows[0];

        if (file.download_otp !== otp) return res.status(401).json({ error: "Invalid OTP." });
        if (file.is_expired) return res.status(401).json({ error: "OTP expired." });

        await pool.query("UPDATE files SET download_otp = NULL, otp_expiry = NULL WHERE id = $1", [file_id]);
        res.status(200).json({ file_data: file.file_data, file_name: file.file_name });

    } catch (err) {
        console.error("File Download Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

app.post('/files/list', async (req, res) => {
    try {
        const { email, chat_with } = req.body;
        let result;

        if (chat_with === 'global') {
            result = await pool.query(
                "SELECT id, sender_email, receiver_email, file_name, timestamp FROM files WHERE receiver_email IS NULL ORDER BY timestamp ASC"
            );
        } else {
            result = await pool.query(
                "SELECT id, sender_email, receiver_email, file_name, timestamp FROM files WHERE (sender_email = $1 AND receiver_email = $2) OR (sender_email = $2 AND receiver_email = $1) ORDER BY timestamp ASC",
                [email, chat_with]
            );
        }
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Get Files Error:", err.message);
        res.status(500).json({ error: "Server Error." });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});