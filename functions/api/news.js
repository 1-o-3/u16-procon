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
        await ensureNewsSchema(env.DB);
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
            const imagesById = await loadCarouselImages(env.DB, results || []);
            const formatted = (results || []).map(row => parseNewsRow(row, imagesById.get(row.id)));
            return new Response(JSON.stringify(formatted), { status: 200, headers: corsHeaders });
        }

        if (method === 'POST') {
            const body = await request.json();
            const { category, title, content, start_date, start_time, end_time, location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments, prefecture, participants, is_tentative, is_past, poster_image } = body;
            const fiscal_year = resolveFiscalYear(body);

            if (!category || !title) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
            }

            // 開催情報は年度(4/1〜翌3/31)ごとに1件のみ
            if (category === '今期の開催情報' && fiscal_year) {
                const sameYear = await env.DB.prepare(`
                    SELECT id FROM news_table WHERE category = '今期の開催情報' AND fiscal_year = ? LIMIT 1;
                `).bind(fiscal_year).first();
                if (sameYear) {
                    return new Response(JSON.stringify({ error: `${fiscal_year}年度の開催情報は既に登録されています。登録済みの大会情報を編集してください。` }), { status: 409, headers: corsHeaders });
                }
            }

            const latest = await env.DB.prepare(`
                SELECT title, content FROM news_table WHERE category = ? ORDER BY created_at DESC, id DESC LIMIT 1;
            `).bind(category).first();

            // 開催情報は年度ごとに1件のため(上で確認済み)、前年度と同じタイトル・概要でも登録できるようにする
            if (category !== '今期の開催情報' && latest && latest.title === title && (latest.content || '') === (content || '')) {
                return new Response(JSON.stringify({ error: '直前の投稿と同じ内容のため、投稿しませんでした。' }), { status: 409, headers: corsHeaders });
            }

            const result = await env.DB.prepare(`
                INSERT INTO news_table (
                    category, title, content, start_date, start_time, end_time,
                    location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments,
                    prefecture, participants, is_tentative, is_past, poster_image, fiscal_year
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                category, title, content || null, start_date || null, start_time || null, end_time || null,
                location || null, map_url || null, overview_url || null, application_url || null, target_age || null,
                divisions ? JSON.stringify(divisions) : null,
                images ? JSON.stringify(images) : null,
                null, // 大会の様子の写真は news_images テーブルに1枚ずつ保存する
                participant_comments ? JSON.stringify(participant_comments) : null,
                prefecture || null, participants || null, is_tentative ? 1 : 0, is_past ? 1 : 0, poster_image || null,
                fiscal_year
            ).run();

            const newId = result.meta.last_row_id;
            await saveCarouselImages(env.DB, newId, past_images);
            return new Response(JSON.stringify(await loadNewsRow(env.DB, newId)), { status: 201, headers: corsHeaders });
        }

        if (method === 'PUT') {
            const body = await request.json();
            const { id, category, title, content, start_date, start_time, end_time, location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments, prefecture, participants, is_tentative, is_past, poster_image } = body;
            const fiscal_year = resolveFiscalYear(body);

            if (!id || !title) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
            }

            await env.DB.prepare(`
                UPDATE news_table SET
                    category = ?, title = ?, content = ?, start_date = ?, start_time = ?, end_time = ?,
                    location = ?, map_url = ?, overview_url = ?, application_url = ?, target_age = ?,
                    divisions = ?, images = ?, past_images = ?, participant_comments = ?,
                    prefecture = ?, participants = ?, is_tentative = ?, is_past = ?, poster_image = ?,
                    fiscal_year = COALESCE(?, fiscal_year)
                WHERE id = ?
            `).bind(
                category, title, content || null, start_date || null, start_time || null, end_time || null,
                location || null, map_url || null, overview_url || null, application_url || null, target_age || null,
                divisions ? JSON.stringify(divisions) : null,
                images ? JSON.stringify(images) : null,
                null, // 大会の様子の写真は news_images テーブルに1枚ずつ保存する
                participant_comments ? JSON.stringify(participant_comments) : null,
                prefecture || null, participants || null, is_tentative ? 1 : 0, is_past ? 1 : 0, poster_image || null,
                fiscal_year,
                id
            ).run();

            await saveCarouselImages(env.DB, id, past_images);
            return new Response(JSON.stringify(await loadNewsRow(env.DB, id)), { status: 200, headers: corsHeaders });
        }

        if (method === 'DELETE') {
            const body = await request.json();
            const { id } = body;
            if (!id) return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400, headers: corsHeaders });

            await env.DB.batch([
                env.DB.prepare(`DELETE FROM news_images WHERE news_id = ?;`).bind(id),
                env.DB.prepare(`DELETE FROM news_table WHERE id = ?;`).bind(id)
            ]);
            return new Response(JSON.stringify({ message: 'Deleted successfully' }), { status: 200, headers: corsHeaders });
        }

    } catch (e) {
        console.error('D1 Error:', e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}

// D1は1行あたり約2MBまでしか保存できない。大会の様子の写真(最大5枚)を1つの列にまとめると
// すぐに超えて保存に失敗するため、写真は news_images テーブルに1枚1行で保存する。
// 年度(fiscal_year)の列も、既存のデータベースに無ければここで追加する。
let newsSchemaReady = false;
async function ensureNewsSchema(db) {
    if (newsSchemaReady) return;
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS news_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            news_id INTEGER NOT NULL,
            position INTEGER NOT NULL,
            data TEXT NOT NULL
        );
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_news_images_news_id ON news_images (news_id);`).run();
    try {
        await db.prepare(`ALTER TABLE news_table ADD COLUMN fiscal_year INTEGER;`).run();
    } catch (e) {
        if (!/duplicate column/i.test(e.message || '')) throw e;
    }
    // 年度が未設定の開催情報は、開催日から年度を求めて埋める
    await db.prepare(`
        UPDATE news_table SET fiscal_year =
            CAST(strftime('%Y', start_date) AS INTEGER) - (CASE WHEN CAST(strftime('%m', start_date) AS INTEGER) < 4 THEN 1 ELSE 0 END)
        WHERE fiscal_year IS NULL AND category = '今期の開催情報' AND strftime('%Y', start_date) IS NOT NULL;
    `).run();
    newsSchemaReady = true;
}

// 開催日があればその年度、無ければ送られてきた年度(管理画面で今期/来期のどちらを編集しているか)を使う
function resolveFiscalYear(body) {
    if (body.category !== '今期の開催情報') return null;
    const m = String(body.start_date || '').match(/^(\d{4})-(\d{2})/);
    if (m) return Number(m[2]) >= 4 ? Number(m[1]) : Number(m[1]) - 1;
    const fy = parseInt(body.fiscal_year, 10);
    return Number.isFinite(fy) ? fy : null;
}

// 写真は全件取得して必要な記事の分だけ使う(IN句のバインド数上限を避けるため。写真は年に数枚程度)
async function loadCarouselImages(db, rows) {
    const map = new Map();
    if (rows.length === 0) return map;
    const ids = new Set(rows.map(r => r.id));
    const { results } = await db.prepare(`SELECT news_id, data FROM news_images ORDER BY news_id, position;`).all();
    (results || []).forEach(img => {
        if (!ids.has(img.news_id)) return;
        if (!map.has(img.news_id)) map.set(img.news_id, []);
        map.get(img.news_id).push(img.data);
    });
    return map;
}

async function saveCarouselImages(db, newsId, images) {
    const list = Array.isArray(images) ? images.filter(Boolean).slice(0, 5) : [];
    await db.batch([
        db.prepare(`DELETE FROM news_images WHERE news_id = ?;`).bind(newsId),
        ...list.map((data, i) => db.prepare(`INSERT INTO news_images (news_id, position, data) VALUES (?, ?, ?);`).bind(newsId, i, data))
    ]);
}

async function loadNewsRow(db, id) {
    const row = await db.prepare(`SELECT * FROM news_table WHERE id = ?;`).bind(id).first();
    if (!row) return null;
    const imagesById = await loadCarouselImages(db, [row]);
    return parseNewsRow(row, imagesById.get(row.id));
}

function parseNewsRow(row, carouselImages) {
    if (!row) return null;
    return {
        ...row,
        divisions: tryParseJson(row.divisions),
        images: tryParseJson(row.images),
        // 以前の形式(past_images列にまとめて保存)のデータも読めるようにする
        past_images: (carouselImages && carouselImages.length > 0) ? carouselImages : tryParseJson(row.past_images),
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
