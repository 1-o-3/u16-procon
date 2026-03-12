document.addEventListener('DOMContentLoaded', () => {
    // Check login state (simple session storage)
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
        showAdminPanel();
    }

    // Login Form logic
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('login-id').value;
            const pass = document.getElementById('login-pass').value;

            if (id === 'u16shizuoka' && pass === 'u16shizuoka') {
                sessionStorage.setItem('isAdminLoggedIn', 'true');
                showAdminPanel();
            } else {
                document.getElementById('login-error').style.display = 'block';
            }
        });
    }

    // Logout logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('isAdminLoggedIn');
            window.location.reload();
        });
    }

    document.getElementById('add-new-btn').addEventListener('click', openAddModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('qa-form').addEventListener('submit', handleFormSubmit);
});

function showAdminPanel() {
    const overlay = document.getElementById('login-overlay');
    const main = document.getElementById('admin-main-content');
    if (overlay) overlay.style.display = 'none';
    if (main) main.style.display = 'block';
    fetchQAData();
}

let qaData = [];

async function fetchQAData() {
    const tbody = document.getElementById('qa-tbody');
    try {
        const response = await fetch('/api/qa');
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        qaData = data;
        renderTable(data);
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ff4b4b;">APIエラー: ローカル環境ではDB接続がないためモックを表示します</td></tr>`;

        // Mock data fallback for UI development without actual DB
        qaData = [
            { id: 1, category: '参加資格について', question: '県外の学校に通っていますが応募可能ですか？', answer: 'はい、原則として静岡県内在住であれば応募可能です。' },
            { id: 2, category: '参加資格について', question: 'チームでの参加は可能ですか？', answer: 'いいえ、本プロコンは個人での参加となります。' },
            { id: 3, category: '作品について', question: '使用できるプログラミング言語に制限はありますか？', answer: '制限はありません。ご自身の得意な言語（Scratch, Python, JavaScript等）で作成してください。' },
            { id: 4, category: '作品について', question: '既存のテンプレートやライブラリは使えますか？', answer: '使用可能ですが、ご自身で作成したオリジナルの部分を明確に記載してください。' },
            { id: 5, category: '審査について', question: '審査基準はどうなっていますか？', answer: 'アイデアの独創性、技術力、完成度、そしてプレゼンテーション能力を総合的に評価します。詳細は大会規約をご確認ください。' }
        ];
        renderTable(qaData);
    }
}

function renderTable(data) {
    const tbody = document.getElementById('qa-tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">データがありません</td></tr>`;
        return;
    }

    // Group data by category
    const grouped = {};
    data.forEach(item => {
        if (!grouped[item.category]) {
            grouped[item.category] = [];
        }
        grouped[item.category].push(item);
    });

    // Render grouped items
    Object.keys(grouped).forEach(category => {
        // Create category header row
        const catRow = document.createElement('tr');
        catRow.innerHTML = `
            <td colspan="4" style="background: rgba(255, 255, 255, 0.05); font-weight: 700; color: var(--primary);">
                ジャンル：${category}
            </td>
        `;
        tbody.appendChild(catRow);

        // Render items for this category
        grouped[category].forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id || '-'}</td>
                <td style="color: var(--text-dim); font-size: 0.9em;">${item.category}</td>
                <td>${item.question}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn edit-btn" data-id="${item.id}">編集</button>
                        <button class="action-btn delete delete-btn" data-id="${item.id}">削除</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteItem(e.target.dataset.id));
    });
}

function openAddModal() {
    document.getElementById('qa-form').reset();
    document.getElementById('entry-id').value = '';
    document.getElementById('modal-title').textContent = 'Q&Aの新規追加';
    document.getElementById('qa-modal').classList.add('active');
}

function openEditModal(id) {
    const item = qaData.find(q => String(q.id) === String(id));
    if (!item) return;

    document.getElementById('entry-id').value = item.id;
    document.getElementById('category').value = item.category;
    document.getElementById('question').value = item.question;
    document.getElementById('answer').value = item.answer;

    document.getElementById('modal-title').textContent = 'Q&Aの編集';
    document.getElementById('qa-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('qa-modal').classList.remove('active');
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('entry-id').value;
    const category = document.getElementById('category').value;
    const question = document.getElementById('question').value;
    const answer = document.getElementById('answer').value;

    const method = id ? 'PUT' : 'POST';

    // Assign category_id based on selection
    const categoryMap = {
        '参加資格について': 1,
        '作品について': 2,
        '審査について': 3,
        'その他': 4
    };
    const category_id = categoryMap[category] || 99;

    const payload = { id, category, question, answer, category_id };

    try {
        const response = await fetch('/api/qa', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to save data');

        await fetchQAData(); // Refresh list
        closeModal();
    } catch (error) {
        console.error(error);

        // --- Fallback for local demo ONLY (since no actual DB is running locally) ---
        console.log(`[シミュレーション] ${method} 操作成功:`, payload);
        if (method === 'POST') {
            qaData.push({ id: Date.now(), ...payload });
        } else {
            const index = qaData.findIndex(q => String(q.id) === String(id));
            if (index > -1) qaData[index] = { ...qaData[index], ...payload };
        }
        renderTable(qaData);
        closeModal();
    }
}

async function deleteItem(id) {
    if (!confirm('本当にこのQ&Aを削除しますか？')) return;

    try {
        const response = await fetch('/api/qa', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });

        if (!response.ok) throw new Error('Failed to delete data');

        await fetchQAData();
    } catch (error) {
        console.error(error);

        // --- Fallback for local demo ONLY ---
        console.log(`[シミュレーション] DELETE 操作成功 ID:`, id);
        qaData = qaData.filter(q => String(q.id) !== String(id));
        renderTable(qaData);
    }
}
