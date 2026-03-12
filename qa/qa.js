document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('qa-content');

    try {
        // Fetch data from simulated Vercel API endpoint
        // NOTE: For local dev without a running server, this will eventually point to the Vercel serverless function `/api/qa`
        // We'll simulate fetching for now using a local mock array if the fetch fails
        let data;
        try {
            const response = await fetch('/api/qa');
            if (!response.ok) throw new Error('API fetch failed');
            data = await response.json();
        } catch (e) {
            console.log("Using mock data as API is not available locally yet.");
            data = [
                { category: '参加資格について', question: '県外の学校に通っていますが応募可能ですか？', answer: 'はい、原則として静岡県内在住であれば応募可能です。' },
                { category: '参加資格について', question: 'チームでの参加は可能ですか？', answer: 'いいえ、本プロコンは個人での参加となります。' },
                { category: '作品について', question: '使用できるプログラミング言語に制限はありますか？', answer: '制限はありません。ご自身の得意な言語（Scratch, Python, JavaScript等）で作成してください。' },
                { category: '作品について', question: '既存のテンプレートやライブラリは使えますか？', answer: '使用可能ですが、ご自身で作成したオリジナルの部分を明確に記載してください。' },
                { category: '審査について', question: '審査基準はどうなっていますか？', answer: 'アイデアの独創性、技術力、完成度、そしてプレゼンテーション能力を総合的に評価します。詳細は大会規約をご確認ください。' }
            ];
        }

        renderQA(data, container);

    } catch (error) {
        container.innerHTML = `<div class="error">データの読み込みに失敗しました。後ほどもう一度お試しください。</div>`;
        console.error('Failed to load QA data:', error);
    }
});

function renderQA(data, container) {
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="loading">現在公開されているQ&Aはありません。</div>';
        return;
    }

    // Group data by category
    const categoriesMap = {};
    data.forEach(item => {
        if (!categoriesMap[item.category]) categoriesMap[item.category] = [];
        categoriesMap[item.category].push({ question: item.question, answer: item.answer });
    });

    const categories = Object.keys(categoriesMap);

    // Build HTML
    let tabsHtml = `<div class="tabs">`;
    categories.forEach((cat, index) => {
        tabsHtml += `<button class="tab-btn ${index === 0 ? 'active' : ''}" data-target="cat-${index}">${cat}</button>`;
    });
    tabsHtml += `</div>`;

    let listsHtml = '';
    categories.forEach((cat, idx) => {
        listsHtml += `<div class="qa-list ${idx === 0 ? 'active' : ''}" id="cat-${idx}">`;
        categoriesMap[cat].forEach(qa => {
            listsHtml += `
                <div class="qa-item">
                    <div class="qa-question">${qa.question}</div>
                    <div class="qa-answer">${qa.answer}</div>
                </div>
            `;
        });
        listsHtml += `</div>`;
    });

    container.innerHTML = tabsHtml + listsHtml;

    // Add Tab Event Listeners
    const tabBtns = document.querySelectorAll('.tab-btn');
    const qaLists = document.querySelectorAll('.qa-list');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');

            tabBtns.forEach(b => b.classList.remove('active'));
            qaLists.forEach(l => l.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });

    // Add Accordion Event Listeners
    const qaItems = document.querySelectorAll('.qa-item');
    qaItems.forEach(item => {
        const question = item.querySelector('.qa-question');
        question.addEventListener('click', () => {
            item.classList.toggle('open');
        });
    });
}
