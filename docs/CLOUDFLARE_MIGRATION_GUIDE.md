# Cloudflare Pages + D1 移行ガイド

本プロジェクト（U-16プログラミングコンテスト 静岡大会 公式サイト）を **Vercel** から **Cloudflare Pages + Cloudflare D1 (SQLite)** へ移行するための完全手順書です。

---

## 1. 移行のメリット

| 項目 | Vercel + Vercel Postgres | Cloudflare Pages + D1 |
| :--- | :--- | :--- |
| **コスト** | 無料枠縮小（クエリ数/コンピュート時間上限） | **完全無料枠が圧倒的**（D1: 毎日500万行読込・10万行書込・5GB） |
| **応答速度** | 外部DB接続（Neon）によるコールドスタートあり | **超高速**（Cloudflareエッジ上でネイティブバインド・コールドスタートほぼゼロ） |
| **帯域幅** | 無料枠100GB/月 | **無制限** |
| **管理** | Vercelダッシュボード | Cloudflareダッシュボード1箇所でドメイン・DNS・CDN・DBを統合管理 |

---

## 2. 移行手順

### ステップ 1: Wrangler CLIのインストール
ターミナルでCloudflareのCLIツールをインストールし、ログインします。
```bash
npm install -g wrangler
wrangler login
```

### ステップ 2: D1 データベースの作成
```bash
wrangler d1 create u16-db
```
実行すると、以下のような設定情報が出力されます：
```toml
[[d1_databases]]
binding = "DB"
database_name = "u16-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### ステップ 3: プロジェクトルートに `wrangler.toml` を作成
プロジェクト直下に `wrangler.toml` を作成し、上記の設定を記載します：
```toml
name = "u16-procon"
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "u16-db"
database_id = "ステップ2で出力されたdatabase_idを記入"
```

### ステップ 4: D1 スキーマと初期データの適用
プロジェクト直下の [d1-schema.sql](file:///c:/Users/J24023/Desktop/_GA/U16-ProCon/d1-schema.sql) を実行します：
```bash
# ローカル開発用
wrangler d1 execute u16-db --local --file=./d1-schema.sql

# 本番環境用
wrangler d1 execute u16-db --remote --file=./d1-schema.sql
```

### ステップ 5: Cloudflare Pages Functions の配置
Cloudflare Pages では、ルート直下の `functions/` ディレクトリに置いたファイルが自動的にエッジAPIエンドポイントになります。
- `/functions/api/news.js`
- `/functions/api/qa.js`
- `/functions/api/fixed.js`
- `/functions/api/setup.js`

#### 例: `/functions/api/news.js` (D1対応コード抜粋)
```javascript
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const method = request.method;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (method === 'GET') {
            let stmt;
            if (category === '過去の開催情報') {
                stmt = env.DB.prepare(`
                    SELECT * FROM news_table 
                    WHERE category = '過去の開催情報' 
                       OR (category = '今期の開催情報' AND (is_past = 1 OR start_date < date('now', 'localtime')))
                    ORDER BY COALESCE(start_date, created_at) DESC;
                `);
            } else if (category === '今期の開催情報') {
                stmt = env.DB.prepare(`SELECT * FROM news_table WHERE category = '今期の開催情報' ORDER BY created_at DESC;`);
            } else if (category) {
                stmt = env.DB.prepare(`SELECT * FROM news_table WHERE category = ? ORDER BY created_at DESC;`).bind(category);
            } else {
                stmt = env.DB.prepare(`SELECT * FROM news_table ORDER BY created_at DESC;`);
            }
            const { results } = await stmt.all();
            return new Response(JSON.stringify(results), { headers: corsHeaders });
        }

        // POST, PUT, DELETE も同様に env.DB.prepare(...).bind(...).run() で対応
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}
```

### ステップ 6: ローカルでの動作確認
```bash
npx wrangler pages dev . --d1 DB=u16-db
```
ブラウザで `http://localhost:8788` にアクセスして動作を確認します。

### ステップ 7: Cloudflare Pages へのデプロイ
GitHubとCloudflare Pagesを連携するか、CLIからデプロイします：
```bash
wrangler pages deploy . --project-name u16-procon
```
Cloudflareのダッシュボードで、Pagesプロジェクトの **設定 > 関数 > D1データベースのバインド** にて、変数名を `DB`、データベースを `u16-db` に設定すれば完了です。
