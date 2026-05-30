const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify(body),
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return response(200, { ok: true });
    }

    if (event.httpMethod !== 'POST') {
        return response(405, { ok: false, error: 'Method Not Allowed' });
    }

    try {
        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Profile update service is not configured correctly.');
        }

        const authHeader = event.headers.authorization || event.headers.Authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();

        if (!token) {
            return response(401, { ok: false, error: 'Missing session token.' });
        }

        const { data: authData, error: authErr } = await admin.auth.getUser(token);
        if (authErr || !authData?.user) {
            return response(401, { ok: false, error: 'Invalid session token.' });
        }

        const body = JSON.parse(event.body || '{}');
        const user = authData.user;
        const name = (body.name || '').trim();
        const handle = (body.handle || '').trim().toLowerCase();
        const phone = (body.phone || '').trim();
        const avatarUrl = body.avatar_url || '';
        const updatePassword = !!body.update_password;
        const password = body.password || '';

        if (handle && !/^[a-z0-9_]{1,30}$/.test(handle)) {
            return response(400, { ok: false, error: 'Handle can only contain letters, numbers, and underscores.' });
        }

        if (updatePassword && password && password.length < 6) {
            return response(400, { ok: false, error: 'Password must be at least 6 characters.' });
        }

        const profilePayload = {
            id: user.id,
            email: user.email,
            name,
            handle: handle || null,
            phone,
        };

        if (updatePassword) {
            profilePayload.password = password || null;
        }

        const { data: profile, error: profileErr } = await admin
            .from('users')
            .upsert(profilePayload, { onConflict: 'id' })
            .select('*')
            .single();

        if (profileErr) throw profileErr;

        const metadata = {
            ...(user.user_metadata || {}),
            avatar_url: avatarUrl,
        };

        if (updatePassword) {
            metadata.account_password = password || null;
        }

        const authPayload = { user_metadata: metadata };
        if (updatePassword && password) {
            authPayload.password = password;
            authPayload.email_confirm = true;
        }

        const { data: updatedAuth, error: updateErr } = await admin.auth.admin.updateUserById(user.id, authPayload);
        if (updateErr) throw updateErr;

        return response(200, {
            ok: true,
            profile,
            user: updatedAuth.user,
        });
    } catch (err) {
        console.error('update-profile error:', err);
        return response(500, { ok: false, error: err.message || 'Could not save profile.' });
    }
};
