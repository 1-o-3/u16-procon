// ========================================================================
// Cloudflare Pages Function: /api/setup
// D1 データベース初期化・テーブル作成
// ========================================================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

export async function onRequest(context) {
    const { env } = context;

    if (!env.DB) {
        return new Response(JSON.stringify({
            success: false,
            error: "D1データベースのバインド 'DB' が見つかりません。Cloudflare Pages の設定 > 関数 > D1データベースのバインド を確認してください。"
        }), { status: 500, headers: corsHeaders });
    }

    try {
        await env.DB.exec(`
            CREATE TABLE IF NOT EXISTS qa_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS inquiries_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                genre TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS news_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                start_date TEXT,
                end_date TEXT,
                start_time TEXT,
                end_time TEXT,
                location TEXT,
                map_url TEXT,
                application_url TEXT,
                overview_url TEXT,
                target_age TEXT,
                divisions TEXT,
                images TEXT,
                prefecture TEXT,
                participants TEXT,
                is_tentative INTEGER DEFAULT 0,
                is_past INTEGER DEFAULT 0,
                past_images TEXT,
                participant_comments TEXT,
                poster_image TEXT,
                fiscal_year INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS news_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                news_id INTEGER NOT NULL,
                position INTEGER NOT NULL,
                data TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_news_images_news_id ON news_images (news_id);

            CREATE TABLE IF NOT EXISTS fixed_content_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT UNIQUE NOT NULL,
                title TEXT,
                content TEXT,
                image TEXT,
                link TEXT,
                sns_data TEXT,
                entry_url TEXT,
                entry_enabled INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        return new Response(JSON.stringify({
            success: true,
            message: "Cloudflare D1 tables initialized successfully!"
        }), { status: 200, headers: corsHeaders });

    } catch (e) {
        console.error('Setup Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), { status: 500, headers: corsHeaders });
    }
}
