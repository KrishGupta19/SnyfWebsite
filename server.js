require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const PORT = 8000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
let supabaseClient = null;
if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
}

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail(name, email, type) {
    const typeLabel = type === 'business' ? 'business partner' : 'early user';
    const { data, error } = await resend.emails.send({
        from: `Snyf <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
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
            <p style="font-size: 12px; color: #aaa;">${process.env.RESEND_FROM_EMAIL || 'thenarcissistdev@gmail.com'}</p>
        </div>
        `,
    });

    if (error) {
        throw new Error(error.message);
    }
}

const server = http.createServer(async (req, res) => {
    // Handle waitlist POST
    if (req.method === 'POST' && (req.url === '/waitlist' || req.url === '/.netlify/functions/waitlist')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { name, email, type } = JSON.parse(body);

                if (supabaseClient) {
                    try {
                        const { error: dbError } = await supabaseClient
                            .from('waitlist')
                            .insert({
                                name: name || '',
                                email: email,
                                type: type || 'user',
                                status: 'new'
                            });
                        if (dbError) {
                            console.error('Supabase waitlist log error:', dbError.message);
                        } else {
                            console.log('Logged waitlist submission to Supabase:', email);
                        }
                    } catch (dbErr) {
                        console.error('Supabase log error:', dbErr.message);
                    }
                }

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
