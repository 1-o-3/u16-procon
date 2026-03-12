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
