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
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
        body: JSON.stringify(body),
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return response(200, { ok: true });
    }

    if (event.httpMethod !== 'GET') {
        return response(405, { ok: false, error: 'Method Not Allowed' });
    }

    try {
        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Profile data service is not configured correctly.');
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

        const type = event.queryStringParameters?.type;
        const userId = authData.user.id;

        if (type === 'orders') {
            const { data, error } = await admin
                .from('orders')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return response(200, { ok: true, rows: data || [] });
        }

        if (type === 'reviews') {
            const { data, error } = await admin
                .from('field_reports')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return response(200, { ok: true, rows: data || [] });
        }

        return response(400, { ok: false, error: 'Unknown profile data type.' });
    } catch (err) {
        console.error('profile-data error:', err);
        return response(500, { ok: false, error: err.message || 'Could not load profile data.' });
    }
};
