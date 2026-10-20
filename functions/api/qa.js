// ========================================================================
// Cloudflare Pages Function: /api/qa
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
        if (method === 'GET') {
            const { results } = await env.DB.prepare(`SELECT * FROM qa_table ORDER BY category_id, id;`).all();
            return new Response(JSON.stringify(results || []), { status: 200, headers: corsHeaders });
        }

        if (method === 'POST') {
            const body = await request.json();
            const { category, category_id, question, answer } = body;
            if (!question || !answer) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
            }

            const latest = await env.DB.prepare(`
                SELECT category, question, answer FROM qa_table ORDER BY created_at DESC, id DESC LIMIT 1;
            `).first();

            if (latest && latest.category === category && latest.question === question && latest.answer === answer) {
                return new Response(JSON.stringify({ error: '直前の登録と同じ内容のため、登録しませんでした。' }), { status: 409, headers: corsHeaders });
            }

            const result = await env.DB.prepare(`
                INSERT INTO qa_table (category, category_id, question, answer) VALUES (?, ?, ?, ?)
            `).bind(category, category_id, question, answer).run();

            const inserted = await env.DB.prepare(`SELECT * FROM qa_table WHERE id = ?;`).bind(result.meta.last_row_id).first();
            return new Response(JSON.stringify(inserted), { status: 201, headers: corsHeaders });
        }

        if (method === 'PUT') {
            const body = await request.json();
            const { id, category, category_id, question, answer } = body;
            if (!id || !question || !answer) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
            }

            await env.DB.prepare(`
                UPDATE qa_table SET category = ?, category_id = ?, question = ?, answer = ? WHERE id = ?
            `).bind(category, category_id, question, answer, id).run();

            const updated = await env.DB.prepare(`SELECT * FROM qa_table WHERE id = ?;`).bind(id).first();
            return new Response(JSON.stringify(updated), { status: 200, headers: corsHeaders });
        }

        if (method === 'DELETE') {
            const body = await request.json();
            const { id } = body;
            if (!id) return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400, headers: corsHeaders });

            await env.DB.prepare(`DELETE FROM qa_table WHERE id = ?;`).bind(id).run();
            return new Response(JSON.stringify({ message: 'Deleted successfully' }), { status: 200, headers: corsHeaders });
        }

    } catch (e) {
        console.error('D1 QA Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}
