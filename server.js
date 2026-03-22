require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const PORT = 8000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});

async function sendWelcomeEmail(name, email, type) {
    const typeLabel = type === 'business' ? 'business partner' : 'early user';
    await transporter.sendMail({
        from: `"Snyf" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "You're on the Snyf waitlist!",
        html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: auto; color: #1a1a1a;">
            <h2 style="color: #7c3aed;">Hey ${name}, you're in! 🎉</h2>
            <p>Thanks for joining the Snyf waitlist as a <strong>${typeLabel}</strong>.</p>
            <p>We're building AI-powered hyperlocal reviews where trust is earned, not bought — and you'll be among the first to experience it.</p>
            <p>We'll reach out as soon as your spot is ready.</p>
            <br/>
            <p style="color: #555;">— The Snyf Team</p>
            <p style="font-size: 12px; color: #aaa;">thenarcissistdev@gmail.com</p>
        </div>
        `,
    });
}

const server = http.createServer(async (req, res) => {
    // Handle waitlist POST
    if (req.method === 'POST' && req.url === '/waitlist') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { name, email, type } = JSON.parse(body);
                await sendWelcomeEmail(name, email, type);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                console.error('Email error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
