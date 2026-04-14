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
            const { category } = request.query;
            let result;
            if (category === '過去の開催情報') {
                result = await sql`
                    SELECT * FROM news_table 
                    WHERE category = '過去の開催情報' 
                       OR (category = '今期の開催情報' AND (is_past = TRUE OR start_date < CURRENT_DATE))
                    ORDER BY created_at DESC;
                `;
            } else if (category === '今期の開催情報') {
                result = await sql`
                    SELECT * FROM news_table 
                    WHERE category = '今期の開催情報' 
                      AND is_past = FALSE
                      AND (start_date IS NULL OR start_date >= CURRENT_DATE)
                    ORDER BY created_at DESC;
                `;
            } else if (category) {
                result = await sql`SELECT * FROM news_table WHERE category = ${category} ORDER BY created_at DESC;`;
            } else {
                result = await sql`SELECT * FROM news_table ORDER BY created_at DESC;`;
            }
            return response.status(200).json(result.rows);
        }

        if (request.method === 'POST') {
            const { category, title, content, start_date, start_time, end_time, location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments, prefecture, participants, is_tentative, is_past } = request.body;
            if (!category || !title) throw new Error('Missing required fields');

            const { rows } = await sql`
                INSERT INTO news_table (
                    category, title, content, start_date, start_time, end_time,
                    location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments,
                    prefecture, participants, is_tentative, is_past
                )
                VALUES (
                    ${category}, ${title}, ${content}, ${start_date || null}, ${start_time || null}, ${end_time || null},
                    ${location || null}, ${map_url || null}, ${overview_url || null}, ${application_url || null}, ${target_age || null}, ${divisions ? JSON.stringify(divisions) : null}, ${images ? JSON.stringify(images) : null}, ${past_images ? JSON.stringify(past_images) : null}, ${participant_comments ? JSON.stringify(participant_comments) : null},
                    ${prefecture || null}, ${participants || null}, ${is_tentative || false}, ${is_past || false}
                )
                RETURNING *;
            `;
            return response.status(201).json(rows[0]);
        }

        if (request.method === 'PUT') {
            const { id, category, title, content, start_date, start_time, end_time, location, map_url, overview_url, application_url, target_age, divisions, images, past_images, participant_comments, prefecture, participants, is_tentative, is_past } = request.body;
            if (!id || !title) throw new Error('Missing required fields');

            const { rows } = await sql`
                UPDATE news_table 
                SET category = ${category}, 
                    title = ${title}, 
                    content = ${content},
                    start_date = ${start_date || null},
                    start_time = ${start_time || null},
                    end_time = ${end_time || null},
                    location = ${location || null},
                    map_url = ${map_url || null},
                    overview_url = ${overview_url || null},
                    application_url = ${application_url || null},
                    target_age = ${target_age || null},
                    divisions = ${divisions ? JSON.stringify(divisions) : null},
                    images = ${images ? JSON.stringify(images) : null},
                    past_images = ${past_images ? JSON.stringify(past_images) : null},
                    participant_comments = ${participant_comments ? JSON.stringify(participant_comments) : null},
                    prefecture = ${prefecture || null},
                    participants = ${participants || null},
                    is_tentative = ${is_tentative || false},
                    is_past = ${is_past || false}
                WHERE id = ${id}
                RETURNING *;
            `;
            return response.status(200).json(rows[0]);
        }

        if (request.method === 'DELETE') {
            const { id } = request.body;
            if (!id) throw new Error('Missing ID');

            await sql`DELETE FROM news_table WHERE id = ${id};`;
            return response.status(200).json({ message: 'Deleted successfully' });
        }

    } catch (error) {
        console.error('Database Error:', error);
        return response.status(500).json({ error: error.message });
    }

    return response.status(405).json({ error: 'Method not allowed' });
}
