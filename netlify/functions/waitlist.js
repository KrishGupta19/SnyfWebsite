const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { name, email, type } = JSON.parse(event.body);
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

        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true }),
        };
    } catch (err) {
        console.error('Email error:', err.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: err.message }),
        };
    }
};
