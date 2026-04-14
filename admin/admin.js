document.addEventListener('DOMContentLoaded', () => {
    // Check login state (simple session storage)
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
        showAdminPanel();
    }

    // Tab switching logic
    const tabs = document.querySelectorAll('.admin-tab');
    const panes = document.querySelectorAll('.admin-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            
            // Remove active classes
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            
            // Add active to clicked
            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

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

    // News Event Listeners
    initNewsLogic();
    
    // Fixed Content Event Listeners
    initFixedLogic();
});

let currentNewsCategory = 'お知らせ';
let currentFixedCategory = 'ABOUT';
let currentImagesBase64 = [];

document.addEventListener('DOMContentLoaded', () => {
    // Other logic is assumed to be handled already...
    document.getElementById('news-preview-btn').addEventListener('click', showNewsPreview);
    document.getElementById('fixed-preview-btn').addEventListener('click', showFixedPreview);
    document.getElementById('close-preview-btn').addEventListener('click', () => {
        document.getElementById('preview-modal').classList.remove('active');
    });
});

function showNewsPreview() {
    const title = document.getElementById('news-title').value || '（タイトル未入力）';
    const content = document.getElementById('news-content').value || '';
    const date = document.getElementById('news-start-date').value;
    const startTime = document.getElementById('news-start-time').value;
    const endTime = document.getElementById('news-end-time').value;
    const tentative = document.getElementById('news-is-tentative').checked;
    const isOther = currentNewsCategory === '他所での開催';
    
    let previewHTML = `<h2 style="color: var(--primary); margin-bottom: 10px;">${title}</h2>`;
    
    if (tentative) {
        previewHTML += `<span style="background: #ff4b4b; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; margin-bottom: 15px; display: inline-block;">予定</span><br>`;
    }

    if (date) {
        previewHTML += `<p style="margin-bottom: 5px;"><strong>📅 開催日:</strong> ${date}</p>`;
    }
    if (startTime || endTime) {
        previewHTML += `<p style="margin-bottom: 15px;"><strong>⏰ 時間:</strong> ${startTime || ''} 〜 ${endTime || ''}</p>`;
    }
    
    previewHTML += `<div style="white-space: pre-wrap; line-height: 1.6; margin-top: 20px;">${content}</div>`;

    document.getElementById('preview-container').innerHTML = previewHTML;
    document.getElementById('preview-modal').classList.add('active');
}

function showFixedPreview() {
    const title = document.getElementById('fixed-title').value || '（見出し未入力）';
    const content = document.getElementById('fixed-content').value || '';
    
    let previewHTML = `<h2 style="color: var(--primary); margin-bottom: 15px;">${title}</h2>`;
    previewHTML += `<div style="white-space: pre-wrap; line-height: 1.6;">${content}</div>`;
    
    document.getElementById('preview-container').innerHTML = previewHTML;
    document.getElementById('preview-modal').classList.add('active');
}

function initNewsLogic() {
    updateNewsFormVisibility(currentNewsCategory);
    
    const newsCategorySelect = document.getElementById('news-category-select');
    if (newsCategorySelect) {
        newsCategorySelect.addEventListener('change', (e) => {
            const cat = e.target.value;
            currentNewsCategory = cat;
            const displayCat = document.getElementById('current-news-category');
            if (displayCat) displayCat.textContent = cat;
            document.getElementById('news-list-category').textContent = cat;
            
            updateNewsFormVisibility(cat);

            document.getElementById('news-form').reset();
            currentImagesBase64 = [];
            document.getElementById('image-preview-container').innerHTML = '';
            
            document.getElementById('news-id').value = '';
            document.getElementById('news-submit-btn').textContent = cat === '過去の開催情報' ? '過去の大会としてアーカイブする' : '投稿する';
            document.getElementById('news-cancel-btn').style.display = 'none';
            fetchNewsData();
        });
    }

    const migrationSelect = document.getElementById('news-migration-select');
    if (migrationSelect) {
        migrationSelect.addEventListener('change', (e) => {
            const id = e.target.value;
            const previewBox = document.getElementById('migration-preview-box');
            if (!id) {
                document.getElementById('news-id').value = '';
                if(previewBox) previewBox.style.display = 'none';
                return;
            }
            document.getElementById('news-id').value = id;
            const item = newsData.find(n => String(n.id) === String(id));
            if (item && previewBox) {
                previewBox.style.display = 'block';
                const d = item.start_date ? String(item.start_date).split('T')[0] : '未設定';
                const t = item.start_time || '';
                previewBox.innerHTML = `
                    <strong style="color: white; font-size: 1.1rem; display: block; margin-bottom: 5px;">${item.title}</strong>
                    <span style="font-size: 0.9rem; display: block; margin-bottom: 10px;">📅 ${d} ${t}</span>
                    <div style="white-space: pre-wrap;">${item.content}</div>
                `;
            }
        });
    }

    document.getElementById('add-comment-btn').addEventListener('click', () => {
        const container = document.getElementById('comments-container');
        const input = document.createElement('textarea');
        input.className = 'news-participant-comment';
        input.rows = 3;
        input.placeholder = '参加者のコメント等...';
        input.style.width = '100%';
        input.style.padding = '12px';
        input.style.background = 'rgba(255,255,255,0.05)';
        input.style.border = '1px solid var(--glass-border)';
        input.style.borderRadius = '8px';
        input.style.color = 'white';
        input.style.marginBottom = '5px';
        container.appendChild(input);
    });

    document.getElementById('news-image-input').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        currentImagesBase64 = [];
        const previewContainer = document.getElementById('image-preview-container');
        previewContainer.innerHTML = '';
        
        const maxFiles = currentNewsCategory === '他所での開催' ? 5 : 1;
        for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (event) => {
                currentImagesBase64.push(event.target.result);
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.height = '60px';
                img.style.borderRadius = '5px';
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('news-form').addEventListener('submit', handleNewsSubmit);
    document.getElementById('news-cancel-btn').addEventListener('click', () => {
        document.getElementById('news-form').reset();
        currentImagesBase64 = [];
        document.getElementById('image-preview-container').innerHTML = '';
        document.getElementById('comments-container').innerHTML = '';
        const previewBox = document.getElementById('migration-preview-box');
        if(previewBox) previewBox.style.display = 'none';
        document.getElementById('news-id').value = '';
        document.getElementById('news-submit-btn').textContent = '投稿する';
        document.getElementById('news-cancel-btn').style.display = 'none';
        updateNewsFormVisibility(currentNewsCategory);
    });
}

function showAdminPanel() {
    const overlay = document.getElementById('login-overlay');
    const main = document.getElementById('admin-main-content');
    if (overlay) overlay.style.display = 'none';
    if (main) main.style.display = 'block';
    fetchQAData();
    fetchNewsData(); 
    fetchFixedData(); // Also load fixed content
}

let qaData = [];
let newsData = [];

function updateNewsFormVisibility(category) {
    const isCurrent = category === '今期の開催情報';
    const isPast = category === '過去の開催情報';
    const isOther = category === '他所での開催';
    const isNotice = category === 'お知らせ';

    const s = sel => document.querySelector(sel).style;

    s('.field-prefecture').display = isOther ? 'block' : 'none';
    s('.field-dates').display = (isCurrent || isOther) ? 'block' : 'none';
    s('#news-auto-migrate-text').display = isCurrent ? 'inline' : 'none';
    s('.field-time-tentative').display = isOther ? 'none' : 'block';
    
    s('.field-location').display = isCurrent ? 'block' : 'none';
    s('.field-map-url').display = isCurrent ? 'block' : 'none';
    s('.field-application').display = isCurrent ? 'block' : 'none';
    
    s('.field-participants-group').display = (isCurrent || isOther) ? 'flex' : 'none';
    s('.field-participants').display = isOther ? 'block' : 'none';
    
    s('.field-divisions').display = (isCurrent || isOther) ? 'block' : 'none';
    s('.field-image').display = (isCurrent || isPast || isOther) ? 'block' : 'none';
    
    const contentLabel = document.getElementById('news-content-label');
    const imageLabel = document.getElementById('news-image-label');
    const imageInput = document.getElementById('news-image-input');
    
    if (isNotice && contentLabel) contentLabel.textContent = '本文';
    else if (contentLabel) contentLabel.textContent = '概要';

    if (imageLabel && imageInput) {
        if (isOther || isPast) {
            imageLabel.innerHTML = '大会の様子（画像5枚まで） <span style="font-size: 0.8rem; color: var(--text-dim);">※最大5MB程度まで</span>';
            imageInput.multiple = true;
        } else {
            imageLabel.innerHTML = '画像投稿（1枚） <span style="font-size: 0.8rem; color: var(--text-dim);">※最大5MB程度まで</span>';
            imageInput.multiple = false;
        }
    }

    s('.field-overview-url').display = isOther ? 'block' : 'none';
    s('.field-migration').display = isPast ? 'block' : 'none';
    s('.field-comments').display = isPast ? 'block' : 'none';

    if (isPast) {
        s('.field-common').display = 'none';
        s('.field-content').display = 'none';
        
        s('#news-form').display = 'block';
        s('#news-form-title').display = 'block';
        s('#past-notice-msg').display = 'block';

        // populate migration select
        const sel = document.getElementById('news-migration-select');
        if (sel) {
            sel.innerHTML = '<option value="">大会を選択してください...</option>';
            const currentEvents = newsData.filter(n => n.category === '今期の開催情報' && !n.is_past);
            currentEvents.forEach(n => {
                sel.innerHTML += `<option value="${n.id}">${n.title}</option>`;
            });
        }
    } else {
        s('.field-common').display = 'block';
        s('.field-content').display = 'block';
        s('#news-form').display = 'block';
        s('#news-form-title').display = 'block';
        s('#past-notice-msg').display = 'none';
    }
}

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
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ff4b4b;">APIエラー: DB接続がないためローカル保存(localStorage)を使用します</td></tr>`;

        // Mock data fallback for UI development without actual DB
        const localData = localStorage.getItem('u16_qa_data');
        if (localData) {
            qaData = JSON.parse(localData);
        } else {
            qaData = [
                { id: 1, category: '参加資格について', question: '県外の学校に通っていますが応募可能ですか？', answer: 'はい、原則として静岡県内在住であれば応募可能です。' },
                { id: 2, category: '参加資格について', question: 'チームでの参加は可能ですか？', answer: 'いいえ、本プロコンは個人での参加となります。' },
                { id: 3, category: '作品について', question: '使用できるプログラミング言語に制限はありますか？', answer: '制限はありません。ご自身の得意な言語（Scratch, Python, JavaScript等）で作成してください。' },
                { id: 4, category: '作品について', question: '既存のテンプレートやライブラリは使えますか？', answer: '使用可能ですが、ご自身で作成したオリジナルの部分を明確に記載してください。' },
                { id: 5, category: '審査について', question: '審査基準はどうなっていますか？', answer: 'アイデアの独創性、技術力、完成度、そしてプレゼンテーション能力を総合的に評価します。詳細は大会規約をご確認ください。' }
            ];
            localStorage.setItem('u16_qa_data', JSON.stringify(qaData));
        }
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
        '部門全体について': 2,
        '競技部門について': 3,
        '作品部門について': 4,
        '審査について': 5,
        '大会当日について': 6,
        'その他': 7
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
            const newId = Date.now();
            qaData.push({ id: newId, ...payload });
        } else {
            const index = qaData.findIndex(q => String(q.id) === String(id));
            if (index > -1) {
                // IMPORTANT: Overwrite rather than replace wrongly
                qaData[index] = { ...qaData[index], ...payload };
            }
        }
        localStorage.setItem('u16_qa_data', JSON.stringify(qaData));
        
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
        localStorage.setItem('mockQAData', JSON.stringify(qaData));
        renderTable(qaData);
    }
}

// ======================
// News Management Logic
// ======================

async function fetchNewsData() {
    const tbody = document.getElementById('news-tbody');
    try {
        const response = await fetch(`/api/news?category=${encodeURIComponent(currentNewsCategory)}`);
        if (!response.ok) throw new Error('Failed to fetch news');
        const data = await response.json();
        newsData = data;
        renderNewsTable(data);
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ff4b4b;">APIエラー: DB接続がないためローカル保存(localStorage)を使用します</td></tr>`;

        const savedData = localStorage.getItem('mockNewsData');
        let allNews = [];
        if (savedData) {
            allNews = JSON.parse(savedData);
        }
        newsData = allNews.filter(n => n.category === currentNewsCategory);
        renderNewsTable(newsData);
    }
}

function renderNewsTable(data) {
    const tbody = document.getElementById('news-tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">まだ記事がありません</td></tr>`;
        return;
    }

    data.forEach(item => {
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('ja-JP') : new Date().toLocaleString('ja-JP');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id || '-'}</td>
            <td>${item.title}</td>
            <td style="color: var(--text-dim); font-size: 0.9em;">${dateStr}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit-news-btn" data-id="${item.id}">編集</button>
                    <button class="action-btn delete delete-news-btn" data-id="${item.id}">削除</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.edit-news-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openEditNews(e.target.dataset.id));
    });

    document.querySelectorAll('.delete-news-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteNews(e.target.dataset.id));
    });
}

function openEditNews(id) {
    const item = newsData.find(n => String(n.id) === String(id));
    if (!item) return;

    document.getElementById('news-id').value = item.id;
    document.getElementById('news-title').value = item.title;
    document.getElementById('news-content').value = item.content;
    
    const dateInput = (val) => val ? new Date(val).toISOString().split('T')[0] : '';
    document.getElementById('news-start-date').value = dateInput(item.start_date);
    document.getElementById('news-start-time').value = item.start_time || '';
    document.getElementById('news-end-time').value = item.end_time || '';
    document.getElementById('news-is-tentative').checked = item.is_tentative || false;
    document.getElementById('news-location').value = item.location || '';
    document.getElementById('news-map-url').value = item.map_url || '';
    document.getElementById('news-application-url').value = item.application_url || '';
    document.getElementById('news-prefecture').value = item.prefecture || '';
    document.getElementById('news-target-age').value = item.target_age || '';
    document.getElementById('news-participants').value = item.participants || '';
    
    document.querySelectorAll('input[name="news-division"]').forEach(cb => {
        if (item.divisions && item.divisions.includes(cb.value)) cb.checked = true;
        else cb.checked = false;
    });

    currentImagesBase64 = item.images || [];
    const previewContainer = document.getElementById('image-preview-container');
    previewContainer.innerHTML = '';
    currentImagesBase64.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.style.height = '60px';
        img.style.borderRadius = '5px';
        previewContainer.appendChild(img);
    });

    const commentsContainer = document.getElementById('comments-container');
    if (commentsContainer) {
        commentsContainer.innerHTML = '';
        if (item.participant_comments && Array.isArray(item.participant_comments)) {
            item.participant_comments.forEach(c => {
                const input = document.createElement('textarea');
                input.className = 'news-participant-comment';
                input.rows = 3;
                input.value = c;
                input.style.width = '100%';
                input.style.padding = '12px';
                input.style.background = 'rgba(255,255,255,0.05)';
                input.style.border = '1px solid var(--glass-border)';
                input.style.borderRadius = '8px';
                input.style.color = 'white';
                input.style.marginBottom = '5px';
                commentsContainer.appendChild(input);
            });
        }
    }

    document.getElementById('news-submit-btn').textContent = '更新する';
    document.getElementById('news-cancel-btn').style.display = 'inline-block';
    
    // Always show form on edit
    document.getElementById('news-form').style.display = 'block';
    document.getElementById('news-form-title').style.display = 'block';
    document.getElementById('past-notice-msg').style.display = 'none';
    
    // Scroll to form smoothly
    document.getElementById('news-form').scrollIntoView({ behavior: 'smooth' });
}

async function handleNewsSubmit(e) {
    e.preventDefault();

    let id = document.getElementById('news-id').value;
    let title = document.getElementById('news-title').value;
    let content = document.getElementById('news-content').value;
    let category = currentNewsCategory;

    const start_date = document.getElementById('news-start-date').value || null;
    const start_time = document.getElementById('news-start-time').value || null;
    const end_time = document.getElementById('news-end-time').value || null;
    const is_tentative = document.getElementById('news-is-tentative').checked;
    const location = document.getElementById('news-location').value || null;
    const map_url = document.getElementById('news-map-url').value || null;
    const application_url = document.getElementById('news-application-url').value || null;
    const overview_url = document.getElementById('news-overview-url').value || null;
    const prefecture = document.getElementById('news-prefecture').value || null;
    const target_age = document.getElementById('news-target-age').value || null;
    const participants = document.getElementById('news-participants').value || null;
    
    const divCheckboxes = document.querySelectorAll('input[name="news-division"]:checked');
    const divisions = Array.from(divCheckboxes).map(cb => cb.value);

    const commentsTextareas = document.querySelectorAll('.news-participant-comment');
    let participant_comments = Array.from(commentsTextareas).map(ta => ta.value).filter(v => v.trim() !== '');
    if (participant_comments.length === 0) participant_comments = null;

    let images = currentImagesBase64.length > 0 ? currentImagesBase64 : null;
    let past_images = null;
    let is_past = false;

    if (currentNewsCategory === '過去の開催情報') {
        if (!id) {
            alert('アーカイブする大会を選択してください。');
            return;
        }
        const item = newsData.find(n => String(n.id) === String(id));
        if (item) {
            category = '今期の開催情報';
            title = item.title;
            content = item.content;
            is_past = true;
            past_images = images;
            images = item.images; // retain existing main images
        }
    } else {
        past_images = null;
    }

    const method = id && currentNewsCategory !== '過去の開催情報' ? 'PUT' : (currentNewsCategory === '過去の開催情報' ? 'PUT' : 'POST');
    const payload = { 
        id, category, title, content, 
        start_date, start_time, end_time, is_tentative, location, map_url, application_url, overview_url, prefecture,
        target_age, participants, divisions, images, past_images, is_past, participant_comments
    };

    try {
        const response = await fetch('/api/news', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to save news data');

        document.getElementById('news-form').reset();
        currentImagesBase64 = [];
        document.getElementById('image-preview-container').innerHTML = '';
        document.getElementById('comments-container').innerHTML = '';
        const previewBox = document.getElementById('migration-preview-box');
        if(previewBox) previewBox.style.display = 'none';
        document.getElementById('news-id').value = '';
        document.getElementById('news-submit-btn').textContent = '投稿する';
        document.getElementById('news-cancel-btn').style.display = 'none';
        
        updateNewsFormVisibility(currentNewsCategory); // reset view logic

        await fetchNewsData(); // Refresh list
    } catch (error) {
        console.error(error);
        
        // --- Fallback for local demo ONLY ---
        let allNews = localStorage.getItem('mockNewsData') ? JSON.parse(localStorage.getItem('mockNewsData')) : [];
        if (method === 'POST') {
            allNews.push({ id: Date.now(), ...payload, created_at: new Date().toISOString() });
        } else {
            const index = allNews.findIndex(n => String(n.id) === String(id));
            if (index > -1) allNews[index] = { ...allNews[index], ...payload };
        }
        localStorage.setItem('mockNewsData', JSON.stringify(allNews));
        
        document.getElementById('news-form').reset();
        currentImagesBase64 = [];
        document.getElementById('image-preview-container').innerHTML = '';
        document.getElementById('news-id').value = '';
        document.getElementById('news-submit-btn').textContent = '投稿する';
        document.getElementById('news-cancel-btn').style.display = 'none';
        
        await fetchNewsData();
    }
}

async function deleteNews(id) {
    if (!confirm('本当にこの記事を削除しますか？')) return;

    try {
        const response = await fetch('/api/news', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });

        if (!response.ok) throw new Error('Failed to delete news data');

        await fetchNewsData();
    } catch (error) {
        console.error(error);

        // --- Fallback for local demo ONLY ---
        let allNews = localStorage.getItem('mockNewsData') ? JSON.parse(localStorage.getItem('mockNewsData')) : [];
        allNews = allNews.filter(n => String(n.id) !== String(id));
        localStorage.setItem('mockNewsData', JSON.stringify(allNews));
        await fetchNewsData();
    }
}

// ======================
// Fixed Content Logic
// ======================

function initFixedLogic() {
    const fixedCategorySelect = document.getElementById('fixed-category-select');
    if (fixedCategorySelect) {
        fixedCategorySelect.addEventListener('change', (e) => {
            currentFixedCategory = e.target.value;
            const text = e.target.options[e.target.selectedIndex].text;
            const displayCat = document.getElementById('current-fixed-category');
            if (displayCat) displayCat.textContent = text;
            updateFixedFormVisibility();
            fetchFixedData();
        });
    }

    const fixedImageInput = document.getElementById('fixed-image-input');
    if (fixedImageInput) {
        fixedImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('画像サイズは最大5MBまでです。');
                    e.target.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentFixedImageBase64 = e.target.result;
                    const previewContainer = document.getElementById('fixed-image-preview');
                    previewContainer.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = currentFixedImageBase64;
                    img.style.height = '100px';
                    img.style.borderRadius = '5px';
                    previewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    document.getElementById('fixed-form').addEventListener('submit', handleFixedSubmit);
}

let currentFixedImageBase64 = null;

function updateFixedFormVisibility() {
    const isAbout = currentFixedCategory === 'ABOUT';
    const isSNS = currentFixedCategory === 'SNS';
    const isClass = currentFixedCategory === 'CLASS_COMP' || currentFixedCategory === 'CLASS_WORK';
    
    document.querySelector('.field-fixed-title').style.display = isSNS ? 'none' : 'block';
    document.querySelector('.field-fixed-content').style.display = isSNS ? 'none' : 'block';
    
    document.querySelector('.field-fixed-image').style.display = isClass ? 'block' : 'none';
    document.querySelector('.field-fixed-link').style.display = isClass ? 'block' : 'none';
    
    document.querySelector('.field-fixed-sns').style.display = isSNS ? 'block' : 'none';
    
    if (isClass) {
        document.getElementById('fixed-content-label').textContent = "詳細 (改行・HTMLが反映されます)";
    } else {
        document.getElementById('fixed-content-label').textContent = "本文 (改行・HTMLが反映されます)";
    }
}

async function fetchFixedData() {
    updateFixedFormVisibility();
    const statusMsg = document.getElementById('fixed-status');
    statusMsg.className = 'status-msg';
    statusMsg.style.display = 'none';
    
    // Reset form first
    document.getElementById('fixed-id').value = '';
    document.getElementById('fixed-title').value = '';
    document.getElementById('fixed-content').value = '';
    document.getElementById('fixed-link').value = '';
    document.getElementById('sns-insta-id').value = '';
    document.getElementById('sns-insta-link').value = '';
    document.getElementById('sns-x-id').value = '';
    document.getElementById('sns-x-link').value = '';
    document.getElementById('sns-youtube-id').value = '';
    document.getElementById('sns-youtube-link').value = '';
    
    currentFixedImageBase64 = null;
    document.getElementById('fixed-image-preview').innerHTML = '';
    document.getElementById('fixed-image-input').value = '';
    
    try {
        const response = await fetch(`/api/fixed?category=${encodeURIComponent(currentFixedCategory)}`);
        if (!response.ok) throw new Error('Failed to fetch fixed content');
        const data = await response.json();
        
        if (data) {
            document.getElementById('fixed-id').value = data.id || '';
            document.getElementById('fixed-title').value = data.title || '';
            document.getElementById('fixed-content').value = data.content || '';
            document.getElementById('fixed-link').value = data.link || '';
            
            if (data.image) {
                currentFixedImageBase64 = data.image;
                const img = document.createElement('img');
                img.src = data.image;
                img.style.height = '100px';
                img.style.borderRadius = '5px';
                document.getElementById('fixed-image-preview').appendChild(img);
            }
            
            if (data.sns_data) {
                let sns = data.sns_data;
                if (typeof sns === 'string') sns = JSON.parse(sns);
                if (sns.insta) {
                    document.getElementById('sns-insta-id').value = sns.insta.id || '';
                    document.getElementById('sns-insta-link').value = sns.insta.link || '';
                }
                if (sns.x) {
                    document.getElementById('sns-x-id').value = sns.x.id || '';
                    document.getElementById('sns-x-link').value = sns.x.link || '';
                }
                if (sns.youtube) {
                    document.getElementById('sns-youtube-id').value = sns.youtube.id || '';
                    document.getElementById('sns-youtube-link').value = sns.youtube.link || '';
                }
            }
        }
    } catch (error) {
        console.error(error);
    }
}

async function handleFixedSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('fixed-title').value;
    const content = document.getElementById('fixed-content').value;
    const link = document.getElementById('fixed-link').value;
    const category = currentFixedCategory;
    const statusMsg = document.getElementById('fixed-status');

    const sns_data = {
        insta: {
            id: document.getElementById('sns-insta-id').value,
            link: document.getElementById('sns-insta-link').value
        },
        x: {
            id: document.getElementById('sns-x-id').value,
            link: document.getElementById('sns-x-link').value
        },
        youtube: {
            id: document.getElementById('sns-youtube-id').value,
            link: document.getElementById('sns-youtube-link').value
        }
    };

    const payload = { 
        category, 
        title, 
        content,
        link,
        image: currentFixedImageBase64,
        sns_data
    };

    try {
        const response = await fetch('/api/fixed', {
            method: 'POST', // The backend upserts it
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to save fixed content');
        
        statusMsg.textContent = '内容を更新しました。';
        statusMsg.className = 'status-msg success';
        statusMsg.style.display = 'block';
        
        setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
        await fetchFixedData(); 
    } catch (error) {
        console.error(error);
    }
}
