import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    try {
        // Create QA table
        await sql`
            CREATE TABLE IF NOT EXISTS qa_table (
                id SERIAL PRIMARY KEY,
                category VARCHAR(255) NOT NULL,
                category_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // Create Inquiries table
        await sql`
            CREATE TABLE IF NOT EXISTS inquiries_table (
                id SERIAL PRIMARY KEY,
                genre VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // Create News/Articles table
        await sql`
            CREATE TABLE IF NOT EXISTS news_table (
                id SERIAL PRIMARY KEY,
                category VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        try {
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS start_date DATE;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS end_date DATE;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS start_time VARCHAR(10);`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS end_time VARCHAR(10);`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS location VARCHAR(255);`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS map_url TEXT;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS application_url TEXT;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS overview_url TEXT;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS target_age VARCHAR(255);`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS divisions JSONB;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS images JSONB;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS prefecture VARCHAR(255);`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS participants VARCHAR(255);`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS is_tentative BOOLEAN DEFAULT FALSE;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS is_past BOOLEAN DEFAULT FALSE;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS past_images JSONB;`;
            await sql`ALTER TABLE news_table ADD COLUMN IF NOT EXISTS participant_comments JSONB;`;
        } catch(e) {
            console.error("Alter columns skipped or failed", e);
        }

        // Create Fixed Content table
        await sql`
            CREATE TABLE IF NOT EXISTS fixed_content_table (
                id SERIAL PRIMARY KEY,
                category VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255),
                content TEXT NOT NULL,
                image TEXT,
                link TEXT,
                sns_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        try {
            await sql`ALTER TABLE fixed_content_table ADD COLUMN IF NOT EXISTS image TEXT;`;
            await sql`ALTER TABLE fixed_content_table ADD COLUMN IF NOT EXISTS link TEXT;`;
            await sql`ALTER TABLE fixed_content_table ADD COLUMN IF NOT EXISTS sns_data JSONB;`;
            await sql`ALTER TABLE fixed_content_table ALTER COLUMN content DROP NOT NULL;`;
        } catch(e) {
            console.error("Alter columns skipped or failed on fixed_content_table", e);
        }

        // Insert sample data to verify (if table is empty)
        const check = await sql`SELECT COUNT(*) FROM qa_table;`;
        if (parseInt(check.rows[0].count) === 0) {
            await sql`
                INSERT INTO qa_table (category, category_id, question, answer)
                VALUES ('参加資格について', 1, 'これはテスト用の質問です。', 'DB接続に成功しました！');
            `;
        }

        return response.status(200).json({
            success: true,
            message: "Database table created and verified with sample data.",
            env_check: process.env.POSTGRES_URL ? "URL is set" : "URL is missing!"
        });
    } catch (error) {
        console.error('Setup Error:', error);
        return response.status(500).json({
            success: false,
            error: error.message,
            hint: "VercelのStorageタブでPostgresがこのプロジェクトにConnectされているか確認してください。"
        });
    }
}
