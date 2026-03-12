import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    try {
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
        return response.status(200).json({ message: "Table created or already exists." });
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
