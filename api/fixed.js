import { sql } from '@vercel/postgres';

async function ensureTableExists() {
    await sql`
        CREATE TABLE IF NOT EXISTS fixed_content_table (
            id SERIAL PRIMARY KEY,
            category VARCHAR(255) UNIQUE NOT NULL,
            title VARCHAR(255),
            content TEXT,
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
        console.error("Alter columns failed on fixed_content_table", e);
    }
}

export default async function handler(request, response) {
    // Enable CORS for API
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    try {
        // Ensure table exists
        await ensureTableExists();

        if (request.method === 'GET') {
            const { category } = request.query;
            let result;
            if (category) {
                result = await sql`SELECT * FROM fixed_content_table WHERE category = ${category};`;
                if (result.rowCount === 0) return response.status(200).json(null);
                return response.status(200).json(result.rows[0]);
            } else {
                result = await sql`SELECT * FROM fixed_content_table;`;
                return response.status(200).json(result.rows);
            }
        }

        if (request.method === 'POST' || request.method === 'PUT') {
            const { category, title, content, image, link, sns_data } = request.body;
            if (!category) throw new Error('Missing required fields');

            // Ensure content is never null to handle potential NOT NULL constraint
            const safeContent = content || '';
            const safeTitle = title || '';

            const existing = await sql`SELECT * FROM fixed_content_table WHERE category = ${category};`;

            if (existing.rowCount > 0) {
                const { rows } = await sql`
                    UPDATE fixed_content_table 
                    SET title = ${safeTitle}, 
                        content = ${safeContent}, 
                        image = ${image || null}, 
                        link = ${link || null}, 
                        sns_data = ${sns_data ? JSON.stringify(sns_data) : null}, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE category = ${category}
                    RETURNING *;
                `;
                return response.status(200).json(rows[0]);
            } else {
                const { rows } = await sql`
                    INSERT INTO fixed_content_table (category, title, content, image, link, sns_data)
                    VALUES (${category}, ${safeTitle}, ${safeContent}, ${image || null}, ${link || null}, ${sns_data ? JSON.stringify(sns_data) : null})
                    RETURNING *;
                `;
                return response.status(201).json(rows[0]);
            }
        }

    } catch (error) {
        console.error('Database Error:', error);
        return response.status(500).json({ error: error.message });
    }

    return response.status(405).json({ error: 'Method not allowed' });
}
