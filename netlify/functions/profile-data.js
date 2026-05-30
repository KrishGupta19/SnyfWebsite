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

        const type   = event.queryStringParameters?.type;
        const userId = authData.user.id;

        // Fetch both orders AND reviews in one call to avoid double cold start
        if (type === 'all') {
            const [ordersRes, reviewsRes] = await Promise.all([
                admin
                    .from('orders')
                    .select('id, venue_id, items, subtotal, gst, service_charge, total, status, table_num, special_instructions, created_at, updated_at')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(30),
                admin
                    .from('field_reports')
                    .select('id, venue_id, venue_name, food, ambience, service, value, wait_time, note, verified, created_at')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(30),
            ]);

            if (ordersRes.error) throw ordersRes.error;
            if (reviewsRes.error) throw reviewsRes.error;

            // Fetch venue names for orders in one query
            const venueIds = [...new Set((ordersRes.data || []).map(o => o.venue_id).filter(Boolean))];
            let venueMap = {};
            if (venueIds.length > 0) {
                const { data: venues } = await admin
                    .from('venues')
                    .select('id, name, slug')
                    .in('id', venueIds);
                (venues || []).forEach(v => { venueMap[v.id] = { name: v.name, slug: v.slug }; });
            }

            const orders = (ordersRes.data || []).map(o => ({
                ...o,
                venue_name: venueMap[o.venue_id]?.name || null,
                venue_slug: venueMap[o.venue_id]?.slug || null,
            }));

            return response(200, {
                ok:      true,
                orders:  orders,
                reviews: reviewsRes.data || [],
            });
        }

        // Legacy single-type queries (keep for backwards compat)
        if (type === 'orders') {
            const { data, error } = await admin
                .from('orders')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(30);
            if (error) throw error;
            return response(200, { ok: true, rows: data || [] });
        }

        if (type === 'reviews') {
            const { data, error } = await admin
                .from('field_reports')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(30);
            if (error) throw error;
            return response(200, { ok: true, rows: data || [] });
        }

        return response(400, { ok: false, error: 'Unknown type.' });
    } catch (err) {
        console.error('profile-data error:', err);
        return response(500, { ok: false, error: err.message || 'Could not load profile data.' });
    }
};
