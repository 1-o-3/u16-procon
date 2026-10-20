// ========================================================================
// Cloudflare Pages Function: /api/fixed
// D1 データベース対応
// ========================================================================

const DELETABLE_CATEGORIES = ['TERMS', 'PRIVACY_POLICY'];

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Content-Type': 'application/json'
};

export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method;

    if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 binding (DB) is missing in Cloudflare Pages settings.' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    try {
        const url = new URL(request.url);

        if (method === 'GET') {
            const category = url.searchParams.get('category');
            if (category) {
                const row = await env.DB.prepare(`SELECT * FROM fixed_content_table WHERE category = ?;`).bind(category).first();
                if (!row) return new Response(JSON.stringify(null), { status: 200, headers: corsHeaders });
                return new Response(JSON.stringify(parseFixedRow(row)), { status: 200, headers: corsHeaders });
            } else {
                const { results } = await env.DB.prepare(`SELECT * FROM fixed_content_table;`).all();
                const formatted = (results || []).map(row => parseFixedRow(row));
                return new Response(JSON.stringify(formatted), { status: 200, headers: corsHeaders });
            }
        }

        if (method === 'POST' || method === 'PUT') {
            const body = await request.json();
            const { category, title, content, image, link, sns_data, entry_url, entry_enabled } = body;

            if (!category) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
            }

            const safeContent = content || '';
            const safeTitle = title || '';
            const safeEntryEnabled = entry_enabled !== false ? 1 : 0;
            const snsJson = sns_data ? JSON.stringify(sns_data) : null;

            const existing = await env.DB.prepare(`SELECT id FROM fixed_content_table WHERE category = ?;`).bind(category).first();

            if (existing) {
                await env.DB.prepare(`
                    UPDATE fixed_content_table SET
                        title = ?, content = ?, image = ?, link = ?, sns_data = ?, entry_url = ?, entry_enabled = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE category = ?
                `).bind(
                    safeTitle, safeContent, image || null, link || null, snsJson, entry_url || null, safeEntryEnabled, category
                ).run();
            } else {
                await env.DB.prepare(`
                    INSERT INTO fixed_content_table (category, title, content, image, link, sns_data, entry_url, entry_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    category, safeTitle, safeContent, image || null, link || null, snsJson, entry_url || null, safeEntryEnabled
                ).run();
            }

            const updated = await env.DB.prepare(`SELECT * FROM fixed_content_table WHERE category = ?;`).bind(category).first();
            return new Response(JSON.stringify(parseFixedRow(updated)), { status: 200, headers: corsHeaders });
        }

        if (method === 'DELETE') {
            const body = await request.json();
            const { category } = body || {};
            if (!DELETABLE_CATEGORIES.includes(category)) {
                return new Response(JSON.stringify({ error: 'This category cannot be deleted' }), { status: 400, headers: corsHeaders });
            }

            await env.DB.prepare(`DELETE FROM fixed_content_table WHERE category = ?;`).bind(category).run();
            return new Response(JSON.stringify({ message: 'Deleted successfully' }), { status: 200, headers: corsHeaders });
        }

    } catch (e) {
        console.error('D1 Fixed Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}

function parseFixedRow(row) {
    if (!row) return null;
    let sns = row.sns_data;
    if (sns && typeof sns === 'string') {
        try { sns = JSON.parse(sns); } catch (e) {}
    }
    return {
        ...row,
        sns_data: sns,
        entry_enabled: Boolean(row.entry_enabled)
    };
}
