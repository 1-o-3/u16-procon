import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    // Enable CORS for API
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    try {
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

            const existing = await sql`SELECT * FROM fixed_content_table WHERE category = ${category};`;

            if (existing.rowCount > 0) {
                const { rows } = await sql`
                    UPDATE fixed_content_table 
                    SET title = ${title}, 
                        content = ${content || null}, 
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
                    VALUES (${category}, ${title}, ${content || null}, ${image || null}, ${link || null}, ${sns_data ? JSON.stringify(sns_data) : null})
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
