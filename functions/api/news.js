// ========================================================================
// Cloudflare Pages Function: /api/news
// D1 データベース対応
// ========================================================================

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
            let query = '';
            let stmt;

            if (category === '過去の開催情報') {
                stmt = env.DB.prepare(`
                    SELECT * FROM news_table 
                    WHERE category = '過去の開催情報' 
                       OR (category = '今期の開催情報' AND (is_past = 1 OR start_date < date('now', 'localtime')))
                    ORDER BY COALESCE(start_date, created_at) DESC;
                `);
            } else if (category === '今期の開催情報') {
                stmt = env.DB.prepare(`
                    SELECT * FROM news_table 
                    WHERE category = '今期の開催情報' 
                    ORDER BY created_at DESC;
                `);
            } else if (category) {
                stmt = env.DB.prepare(`SELECT * FROM news_table WHERE category = ? ORDER BY created_at DESC;`).bind(category);
            } else {
                stmt = env.DB.prepare(`SELECT * FROM news_table ORDER BY created_at DESC;`);
            }

            const { results } = await stmt.all();
            const formatted = (results || []).map(row => parseNewsRow(row));
            return new Response(JSON.stringify(formatted), { status: 200, headers: corsHeaders });
        }

        if (method === 'POST') {
            const body = await request.json();
            const { category, title, content, start_date, start_time, end_time, location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments, prefecture, participants, is_tentative, is_past, poster_image } = body;

            if (!category || !title) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
            }

            if (category === '今期の開催情報') {
                const active = await env.DB.prepare(`
                    SELECT id FROM news_table WHERE category = '今期の開催情報' AND is_past = 0 LIMIT 1;
                `).first();
                if (active) {
                    return new Response(JSON.stringify({ error: '今期の開催情報は1件のみです。表示中の大会情報を編集してください。' }), { status: 409, headers: corsHeaders });
                }
            }

            const latest = await env.DB.prepare(`
                SELECT title, content FROM news_table WHERE category = ? ORDER BY created_at DESC, id DESC LIMIT 1;
            `).bind(category).first();

            if (latest && latest.title === title && (latest.content || '') === (content || '')) {
                return new Response(JSON.stringify({ error: '直前の投稿と同じ内容のため、投稿しませんでした。' }), { status: 409, headers: corsHeaders });
            }

            const result = await env.DB.prepare(`
                INSERT INTO news_table (
                    category, title, content, start_date, start_time, end_time,
                    location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments,
                    prefecture, participants, is_tentative, is_past, poster_image
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                category, title, content || null, start_date || null, start_time || null, end_time || null,
                location || null, map_url || null, overview_url || null, application_url || null, target_age || null,
                divisions ? JSON.stringify(divisions) : null,
                images ? JSON.stringify(images) : null,
                past_images ? JSON.stringify(past_images) : null,
                participant_comments ? JSON.stringify(participant_comments) : null,
                prefecture || null, participants || null, is_tentative ? 1 : 0, is_past ? 1 : 0, poster_image || null
            ).run();

            const inserted = await env.DB.prepare(`SELECT * FROM news_table WHERE id = ?;`).bind(result.meta.last_row_id).first();
            return new Response(JSON.stringify(parseNewsRow(inserted)), { status: 201, headers: corsHeaders });
        }

        if (method === 'PUT') {
            const body = await request.json();
            const { id, category, title, content, start_date, start_time, end_time, location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments, prefecture, participants, is_tentative, is_past, poster_image } = body;

            if (!id || !title) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
            }

            await env.DB.prepare(`
                UPDATE news_table SET
                    category = ?, title = ?, content = ?, start_date = ?, start_time = ?, end_time = ?,
                    location = ?, map_url = ?, overview_url = ?, application_url = ?, target_age = ?,
                    divisions = ?, images = ?, past_images = ?, participant_comments = ?,
                    prefecture = ?, participants = ?, is_tentative = ?, is_past = ?, poster_image = ?
                WHERE id = ?
            `).bind(
                category, title, content || null, start_date || null, start_time || null, end_time || null,
                location || null, map_url || null, overview_url || null, application_url || null, target_age || null,
                divisions ? JSON.stringify(divisions) : null,
                images ? JSON.stringify(images) : null,
                past_images ? JSON.stringify(past_images) : null,
                participant_comments ? JSON.stringify(participant_comments) : null,
                prefecture || null, participants || null, is_tentative ? 1 : 0, is_past ? 1 : 0, poster_image || null,
                id
            ).run();

            const updated = await env.DB.prepare(`SELECT * FROM news_table WHERE id = ?;`).bind(id).first();
            return new Response(JSON.stringify(parseNewsRow(updated)), { status: 200, headers: corsHeaders });
        }

        if (method === 'DELETE') {
            const body = await request.json();
            const { id } = body;
            if (!id) return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400, headers: corsHeaders });

            await env.DB.prepare(`DELETE FROM news_table WHERE id = ?;`).bind(id).run();
            return new Response(JSON.stringify({ message: 'Deleted successfully' }), { status: 200, headers: corsHeaders });
        }

    } catch (e) {
        console.error('D1 Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}

function parseNewsRow(row) {
    if (!row) return null;
    return {
        ...row,
        divisions: tryParseJson(row.divisions),
        images: tryParseJson(row.images),
        past_images: tryParseJson(row.past_images),
        participant_comments: tryParseJson(row.participant_comments),
        is_tentative: Boolean(row.is_tentative),
        is_past: Boolean(row.is_past)
    };
}

function tryParseJson(val) {
    if (!val) return null;
    if (typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch (e) { return val; }
}
