import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    // Enable CORS for API
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    try {
        if (request.method === 'GET') {
            const { rows } = await sql`SELECT * FROM qa_table ORDER BY category_id, id;`;
            return response.status(200).json(rows);
        }

        if (request.method === 'POST') {
            const { category, category_id, question, answer } = request.body;
            if (!question || !answer) throw new Error('Missing required fields');

            const { rows } = await sql`
                INSERT INTO qa_table (category, category_id, question, answer)
                VALUES (${category}, ${category_id}, ${question}, ${answer})
                RETURNING *;
            `;
            return response.status(201).json(rows[0]);
        }

        if (request.method === 'PUT') {
            const { id, category, category_id, question, answer } = request.body;
            if (!id || !question || !answer) throw new Error('Missing required fields');

            const { rows } = await sql`
                UPDATE qa_table 
                SET category = ${category}, category_id = ${category_id}, question = ${question}, answer = ${answer}
                WHERE id = ${id}
                RETURNING *;
            `;
            return response.status(200).json(rows[0]);
        }

        if (request.method === 'DELETE') {
            const { id } = request.body;
            if (!id) throw new Error('Missing ID');

            await sql`DELETE FROM qa_table WHERE id = ${id};`;
            return response.status(200).json({ message: 'Deleted successfully' });
        }

    } catch (error) {
        console.error('Database Error:', error);

        // --- Fallback Mechanism for Local Development Output ---
        // Since Vercel DB won't work locally without complex setup, 
        // we return 500 error to trigger the frontend's local mock simulations
        return response.status(500).json({ error: error.message });
    }

    return response.status(405).json({ error: 'Method not allowed' });
}
