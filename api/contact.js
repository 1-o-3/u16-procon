import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    // Enable CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method === 'POST') {
        const { genre, name, email, subject, message } = request.body;

        if (!name || !email || !message) {
            return response.status(400).json({ error: '必須項目が不足しています。' });
        }

        try {
            const { rows } = await sql`
                INSERT INTO inquiries_table (genre, name, email, subject, message)
                VALUES (${genre}, ${name}, ${email}, ${subject}, ${message})
                RETURNING *;
            `;

            // Note: Ideally, you'd also send an email here using a service like SendGrid or Formspree.
            // For now, it's stored in the DB which is more reliable than console logs.

            return response.status(201).json({ success: true, data: rows[0] });
        } catch (error) {
            console.error('Inquiry Submission Error:', error);
            return response.status(500).json({ error: 'データの保存に失敗しました。' });
        }
    }

    return response.status(405).json({ error: 'Method not allowed' });
}
