-- ========================================================================
-- Cloudflare D1 データベース スキーマ定義 (u16-procon)
-- SQLite 互換
-- ========================================================================

-- 1. Q&A テーブル
CREATE TABLE IF NOT EXISTS qa_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. お問い合わせ テーブル
CREATE TABLE IF NOT EXISTS inquiries_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    genre TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. お知らせ・開催情報 テーブル
CREATE TABLE IF NOT EXISTS news_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    start_date TEXT, -- YYYY-MM-DD
    end_date TEXT,   -- YYYY-MM-DD
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    map_url TEXT,
    application_url TEXT,
    overview_url TEXT,
    target_age TEXT,
    divisions TEXT, -- JSON文字列
    images TEXT,    -- JSON文字列
    prefecture TEXT,
    participants TEXT,
    is_tentative INTEGER DEFAULT 0,
    is_past INTEGER DEFAULT 0,
    past_images TEXT, -- JSON文字列
    participant_comments TEXT, -- JSON文字列
    poster_image TEXT,
    fiscal_year INTEGER, -- 開催年度 (4/1〜翌3/31。2026年度=2026)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3-2. 過去の開催情報の写真 (カルーセル用・1記事最大5枚)
-- D1は1行あたり約2MBまでのため、写真は1枚1行で保存する
CREATE TABLE IF NOT EXISTS news_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_news_images_news_id ON news_images (news_id);

-- 4. 固定コンテンツ テーブル (ABOUT, 部門紹介, ツール, SNS, スポンサー)
CREATE TABLE IF NOT EXISTS fixed_content_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    image TEXT,
    link TEXT,
    sns_data TEXT, -- JSON文字列
    entry_url TEXT,
    entry_enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初期シードデータ (Q&A)
INSERT OR IGNORE INTO qa_table (id, category, category_id, question, answer) VALUES
(1, '参加資格について', 1, '県外の学校に通っていますが応募可能ですか？', 'はい、原則として静岡県内在住であれば応募可能です。'),
(2, '参加資格について', 1, 'チームでの参加は可能ですか？', 'いいえ、本プロコンは個人での参加となります。'),
(3, '作品について', 4, '使用できるプログラミング言語に制限はありますか？', '制限はありません。ご自身の得意な言語（Scratch, Python, JavaScript等）で作成してください。'),
(4, '作品について', 4, '既存のテンプレートやライブラリは使えますか？', '使用可能ですが、ご自身で作成したオリジナルの部分を明確に記載してください。'),
(5, '審査について', 5, '審査基準はどうなっていますか？', 'アイデアの独創性、技術力、完成度、そしてプレゼンテーション能力を総合的に評価します。詳細は大会規約をご確認ください。');

-- 初期シードデータ (固定コンテンツ)
INSERT OR IGNORE INTO fixed_content_table (category, title, content, entry_url) VALUES
('ABOUT', 'U-16プロコンとは', '「U-16プログラミングコンテスト 静岡大会」は、静岡県内の小・中・高校生を対象とした、次世代のITリーダーを発揮するためのステージです。\n\nプログラミングを通じて課題を解決したり、新しいエンターテインメントを生み出したりする創造力を募集しています。これまでの成果を披露し、多くの仲間と切磋琢磨しましょう。', NULL),
('CLASS_COMP', '競技部門', '対戦型プログラムを作成し、アルゴリズムや戦略を競い合う部門です。\n\nU-16部門（16歳以下対象）：初心者から参加可能な対戦型プログラミングです。\n\n他者のコードと対戦させることで、より高度なロジックへの理解を深めます。', 'https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/entry'),
('CLASS_WORK', '作品部門', '自由なアイデアでWebサイト、アプリ、ゲームなどを制作する部門です。技術的な完成度だけでなく、独創性や社会への有用性が評価されます。', 'https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/works'),
('TOOLS', 'ツール紹介', '[{"name":"Blockly Chaser","url":"https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/","description":"競技部門で使用する対戦型プログラミングツールです。ブロックを組み合わせてプログラムを作成し、他のプレイヤーと対戦できます。"}]', NULL);
