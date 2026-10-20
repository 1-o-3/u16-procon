// ========================================================================
// Vercel Postgres → Cloudflare D1 データ移行スクリプト
//
// 使い方 (プロジェクトのルートで実行):
//   node --env-file=.env scripts/migrate-postgres-to-d1.mjs            … 確認のみ(D1には書き込まない)
//   node --env-file=.env scripts/migrate-postgres-to-d1.mjs --apply    … D1へ書き込む
//   node scripts/migrate-postgres-to-d1.mjs --from-api=https://u16-procon.vercel.app [--apply]
//
// ・Postgresの接続先は .env の POSTGRES_URL を使う
// ・--from-api を付けると、Postgresに直接つながず、Vercel版サイトの公開API(/api/qa・/api/fixed・/api/news)から読み込む
//   (お問い合わせ(inquiries_table)は公開APIで取得できないため移行しない)
// ・D1へは Cloudflare の REST API で書き込む。トークンは環境変数 CLOUDFLARE_API_TOKEN、
//   無ければ wrangler のログイン情報(npx wrangler login / whoami で更新)を使う
// ・Postgresにデータがあるテーブルは、D1側の内容(初期データ)を消してから同じIDで入れ直す
// ・過去の開催情報の写真(past_images)は news_images テーブルに1枚1行で保存する(D1の1行2MB制限のため)
// ========================================================================

import { createPool } from '@vercel/postgres';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ACCOUNT_ID = 'fa8a53510739344a14abb2e92ed06625';
const DATABASE_ID = '93d29241-9a11-43b7-a927-76ca098f800c'; // u16-db
const APPLY = process.argv.includes('--apply');
const FROM_API = (process.argv.find(a => a.startsWith('--from-api=')) || '').slice('--from-api='.length).replace(/\/$/, '');
const API_ENDPOINTS = { qa_table: '/api/qa', fixed_content_table: '/api/fixed', news_table: '/api/news' };
const D1_MAX_ROW_BYTES = 2_000_000;

function getApiToken() {
    if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
    const candidates = [
        path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml'),
        path.join(os.homedir(), '.config', '.wrangler', 'config', 'default.toml'),
        path.join(os.homedir(), 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
    ];
    for (const file of candidates) {
        if (!fs.existsSync(file)) continue;
        const toml = fs.readFileSync(file, 'utf8');
        const token = toml.match(/^oauth_token = "(.+)"$/m);
        const expires = toml.match(/^expiration_time = "(.+)"$/m);
        if (expires && new Date(expires[1]) < new Date()) {
            throw new Error('wranglerのログイン情報の有効期限が切れています。`npx wrangler whoami` を実行してから再度お試しください。');
        }
        if (token) return token[1];
    }
    throw new Error('Cloudflareのトークンが見つかりません。CLOUDFLARE_API_TOKEN を設定するか `npx wrangler login` してください。');
}

async function d1(sql, params = []) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
        throw new Error(`D1 query failed (${res.status}): ${JSON.stringify(json.errors || json)}\n  SQL: ${sql.slice(0, 120)}`);
    }
    return json.result?.[0]?.results || [];
}

// ---- 値の変換 (Postgres → SQLite) ----
const pad = n => String(n).padStart(2, '0');
function toDateOnly(v) {
    if (v == null) return null;
    if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    const m = String(v).match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : String(v);
}
// SQLiteの CURRENT_TIMESTAMP と同じ形式(UTC)
function toTimestamp(v) {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return String(v);
    return d.toISOString().replace('T', ' ').slice(0, 19);
}
function toJsonText(v) {
    if (v == null) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
}
function toJsonArray(v) {
    if (v == null) return [];
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
    return Array.isArray(v) ? v.filter(Boolean) : [];
}
const toBool = v => (v === true || v === 1 || v === 't' || v === 'true') ? 1 : 0;
const toText = v => (v == null ? null : String(v));
function fiscalYearOf(dateStr) {
    const m = String(dateStr || '').match(/^(\d{4})-(\d{2})/);
    if (!m) return null;
    return Number(m[2]) >= 4 ? Number(m[1]) : Number(m[1]) - 1;
}
const byteLength = v => (v == null ? 0 : Buffer.byteLength(String(v)));

// ---- テーブルごとの変換 ----
const TABLES = {
    qa_table: row => ({
        id: row.id, category: row.category, category_id: row.category_id,
        question: row.question, answer: row.answer, created_at: toTimestamp(row.created_at),
    }),
    inquiries_table: row => ({
        id: row.id, genre: row.genre, name: row.name, email: row.email,
        subject: row.subject, message: row.message, created_at: toTimestamp(row.created_at),
    }),
    fixed_content_table: row => ({
        id: row.id, category: row.category, title: toText(row.title), content: toText(row.content),
        image: toText(row.image), link: toText(row.link), sns_data: toJsonText(row.sns_data),
        entry_url: toText(row.entry_url),
        entry_enabled: row.entry_enabled == null ? 1 : toBool(row.entry_enabled),
        created_at: toTimestamp(row.created_at), updated_at: toTimestamp(row.updated_at ?? row.created_at),
    }),
    news_table: row => {
        const start_date = toDateOnly(row.start_date);
        return {
            id: row.id, category: row.category, title: row.title, content: toText(row.content),
            start_date, end_date: toDateOnly(row.end_date),
            start_time: toText(row.start_time), end_time: toText(row.end_time),
            location: toText(row.location), map_url: toText(row.map_url),
            application_url: toText(row.application_url), overview_url: toText(row.overview_url),
            target_age: toText(row.target_age), divisions: toJsonText(row.divisions),
            images: toJsonText(row.images), prefecture: toText(row.prefecture), participants: toText(row.participants),
            is_tentative: toBool(row.is_tentative), is_past: toBool(row.is_past),
            past_images: null, // news_images に移す
            participant_comments: toJsonText(row.participant_comments),
            poster_image: toText(row.poster_image),
            fiscal_year: row.category === '今期の開催情報' ? fiscalYearOf(start_date) : null,
            created_at: toTimestamp(row.created_at),
        };
    },
};

async function readSourceTable(pool, table) {
    if (FROM_API) {
        if (!API_ENDPOINTS[table]) return null;
        const res = await fetch(FROM_API + API_ENDPOINTS[table]);
        if (!res.ok) throw new Error(`${FROM_API}${API_ENDPOINTS[table]} の取得に失敗しました (${res.status})`);
        const rows = await res.json();
        return (Array.isArray(rows) ? rows : []).sort((a, b) => a.id - b.id);
    }
    try {
        const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY id;`);
        return rows;
    } catch (e) {
        if (/does not exist/i.test(e.message)) return null;
        throw e;
    }
}

async function insertRow(table, record) {
    const cols = Object.keys(record);
    await d1(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')});`,
        cols.map(c => record[c])
    );
}

// ---- メイン ----
const apiToken = APPLY ? getApiToken() : null;
if (!FROM_API && !process.env.POSTGRES_URL) throw new Error('POSTGRES_URL がありません。`node --env-file=.env ...` で実行してください。');
const pool = FROM_API ? null : createPool({ connectionString: process.env.POSTGRES_URL });
console.log(`読み込み元: ${FROM_API ? FROM_API + ' (公開API)' : 'Postgres (POSTGRES_URL)'}`);

try {
    const plan = [];
    for (const [table, convert] of Object.entries(TABLES)) {
        const rows = await readSourceTable(pool, table);
        if (rows == null) { console.log(`- ${table}: 読み込み元にありません(スキップ)`); continue; }
        const records = rows.map(convert);
        const carousel = new Map();
        if (table === 'news_table') {
            rows.forEach(r => {
                const imgs = toJsonArray(r.past_images).slice(0, 5);
                if (imgs.length > 0) carousel.set(r.id, imgs);
            });
        }
        const tooLarge = records.filter(r => Object.values(r).reduce((s, v) => s + byteLength(v), 0) > D1_MAX_ROW_BYTES);
        const totalMb = records.reduce((s, r) => s + Object.values(r).reduce((a, v) => a + byteLength(v), 0), 0) / 1024 / 1024;
        const photoCount = [...carousel.values()].reduce((s, a) => s + a.length, 0);
        console.log(`- ${table}: ${records.length}件 (約${totalMb.toFixed(1)}MB)` +
            (table === 'news_table' ? ` / 大会の様子の写真 ${photoCount}枚` : '') +
            (tooLarge.length ? ` ⚠️ 2MB超の行: ID ${tooLarge.map(r => r.id).join(', ')}` : ''));
        if (table === 'news_table') {
            records.forEach(r => console.log(`    ID ${r.id} [${r.category}] ${r.title} ${r.start_date || ''}${r.fiscal_year ? ` (${r.fiscal_year}年度)` : ''}${carousel.has(r.id) ? ` 写真${carousel.get(r.id).length}枚` : ''}`));
        }
        plan.push({ table, records, carousel, tooLarge });
    }

    if (!APPLY) {
        console.log('\n確認のみ実行しました。D1へ書き込むには --apply を付けて実行してください。');
        process.exit(0);
    }

    const blocked = plan.filter(p => p.tooLarge.length > 0);
    if (blocked.length > 0) {
        throw new Error('D1の1行あたりの上限(2MB)を超える行があるため中止しました: ' + blocked.map(p => p.table).join(', '));
    }

    for (const { table, records, carousel } of plan) {
        if (records.length === 0) { console.log(`- ${table}: 読み込み元が0件のため、D1の内容はそのまま残します`); continue; }
        if (table === 'news_table') await d1('DELETE FROM news_images;');
        await d1(`DELETE FROM ${table};`);
        for (const record of records) {
            await insertRow(table, record);
            const imgs = carousel.get(record.id) || [];
            for (let i = 0; i < imgs.length; i++) {
                await d1('INSERT INTO news_images (news_id, position, data) VALUES (?, ?, ?);', [record.id, i, imgs[i]]);
            }
        }
        // IDを指定して入れているので、以降の新規投稿のIDは自動で移行したIDの続きから採番される
        const [{ n }] = await d1(`SELECT COUNT(*) AS n FROM ${table};`);
        console.log(`✅ ${table}: ${n}件 移行しました`);
    }
    console.log('\n移行が完了しました。');
} finally {
    if (pool) await pool.end();
}
