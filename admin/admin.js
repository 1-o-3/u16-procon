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

    // Database setup logic
    const setupDbBtn = document.getElementById('setup-db-btn');
    if (setupDbBtn) {
        setupDbBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!confirm('データベースのテーブル初期化およびアップデートを実行しますか？（既存のデータは削除されません）')) {
                return;
            }
            
            setupDbBtn.textContent = '初期化中...';
            setupDbBtn.style.pointerEvents = 'none';
            setupDbBtn.style.opacity = '0.5';
            
            try {
                const res = await fetch('/api/setup');
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('データベース初期化に成功しました！\n' + data.message);
                    window.location.reload();
                } else {
                    alert('初期化に失敗しました:\n' + (data.error || data.message || 'Unknown error'));
                }
            } catch (err) {
                console.error(err);
                alert('通信エラーが発生しました: ' + err.message);
            } finally {
                setupDbBtn.textContent = 'データベース初期化';
                setupDbBtn.style.pointerEvents = 'auto';
                setupDbBtn.style.opacity = '1';
            }
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

let subdivisionNames = ["U-16", "O-16"];

function extractSubdivisionsFromNews(newsList) {
    const found = new Set();
    newsList.forEach(item => {
        let divs = item.divisions;
        if (divs) {
            if (typeof divs === 'string') {
                try { divs = JSON.parse(divs); } catch (e) { divs = []; }
            }
            if (Array.isArray(divs)) {
                divs.forEach(d => {
                    const match = d.match(/^競技部門 \((.+)\)$/);
                    if (match) {
                        found.add(match[1]);
                    }
                });
            }
        }
    });
    return Array.from(found);
}

async function loadAllSubdivisions() {
    const defaults = ["U-16", "O-16"];
    const custom = JSON.parse(localStorage.getItem('u16_custom_subdivisions') || '[]');
    
    let dbSubs = [];
    try {
        const res = await fetch('/api/news');
        if (res.ok) {
            const allNews = await res.json();
            dbSubs = extractSubdivisionsFromNews(allNews);
        }
    } catch (e) {
        console.error("Failed to load subdivisions from DB:", e);
        const localNews = JSON.parse(localStorage.getItem('mockNewsData') || '[]');
        dbSubs = extractSubdivisionsFromNews(localNews);
    }
    
    const merged = new Set([...defaults, ...custom, ...dbSubs]);
    subdivisionNames = Array.from(merged);
}

function renderSubdivisions(checkedDivisions = ["競技部門 (U-16)"]) {
    const container = document.getElementById('subdivisions-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    subdivisionNames.forEach(name => {
        const value = `競技部門 (${name})`;
        const isChecked = checkedDivisions.includes(value);
        
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; color: var(--text-main); margin: 0; cursor: pointer; font-size: 0.95rem;';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'news-division';
        input.value = value;
        input.checked = isChecked;
        input.style.cssText = 'width: 20px; height: 20px; margin: 0; cursor: pointer; accent-color: var(--primary);';
        
        input.addEventListener('change', () => {
            const parentCheckbox = document.getElementById('news-division-comp');
            if (input.checked && parentCheckbox) {
                parentCheckbox.checked = true;
                syncCompSubdivisions();
            }
        });
        
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${name}部門`));
        
        container.appendChild(label);
    });

    // Sync parent checkbox state
    const parentCheckbox = document.getElementById('news-division-comp');
    if (parentCheckbox) {
        const hasComp = checkedDivisions.includes('競技部門') || checkedDivisions.some(d => d.startsWith('競技部門 ('));
        parentCheckbox.checked = hasComp;
    }
}

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
            renderSubdivisions(["競技部門 (U-16)"]);
            syncCompSubdivisions();
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
                    <strong style="color: var(--primary); font-size: 1.1rem; display: block; margin-bottom: 5px;">${item.title}</strong>
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
        input.style.background = '#ffffff';
        input.style.border = '1px solid var(--primary-light)';
        input.style.borderRadius = '8px';
        input.style.color = 'var(--text-main)';
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
        renderSubdivisions(["競技部門 (U-16)"]);
        syncCompSubdivisions();
    });

    // Subdivisions Toggle & Check Synchronization
    const parentCheckbox = document.getElementById('news-division-comp');
    if (parentCheckbox) {
        parentCheckbox.addEventListener('change', syncCompSubdivisions);
    }

    const addSubdivisionBtn = document.getElementById('add-subdivision-btn');
    if (addSubdivisionBtn) {
        addSubdivisionBtn.addEventListener('click', async () => {
            const name = prompt('追加する部門の名前を入力してください (例: アドバンス):');
            if (!name) return;
            const trimmed = name.trim();
            if (!trimmed) return;
            
            if (subdivisionNames.includes(trimmed)) {
                alert('その部門名は既に存在します。');
                return;
            }
            
            const custom = JSON.parse(localStorage.getItem('u16_custom_subdivisions') || '[]');
            if (!custom.includes(trimmed)) {
                custom.push(trimmed);
                localStorage.setItem('u16_custom_subdivisions', JSON.stringify(custom));
            }
            
            await loadAllSubdivisions();
            
            const checked = Array.from(document.querySelectorAll('input[name="news-division"]:checked')).map(cb => cb.value);
            const newValue = `競技部門 (${trimmed})`;
            if (!checked.includes(newValue)) {
                checked.push(newValue);
            }
            
            renderSubdivisions(checked);
            
            const parentCb = document.getElementById('news-division-comp');
            if (parentCb) {
                parentCb.checked = true;
            }
            syncCompSubdivisions();
        });
    }

    loadAllSubdivisions().then(() => {
        renderSubdivisions(["競技部門 (U-16)"]);
        syncCompSubdivisions();
    });
}

function syncCompSubdivisions() {
    const parentCheckbox = document.getElementById('news-division-comp');
    const container = document.getElementById('subdivisions-container');

    if (!parentCheckbox || !container) return;

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');

    if (parentCheckbox.checked) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
        checkboxes.forEach(cb => {
            cb.disabled = false;
        });
    } else {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.disabled = true;
        });
    }
}

function showAdminPanel() {
    const overlay = document.getElementById('login-overlay');
    const main = document.getElementById('admin-main-content');
    if (overlay) overlay.style.display = 'none';
    if (main) main.style.display = 'block';

    // Initialize local fixed data if not present
    if (!localStorage.getItem('mockFixedData')) {
        const defaultFixed = [
            {
                category: 'ABOUT',
                title: 'U-16プロコンとは',
                content: '「U-16プログラミングコンテスト 静岡大会」は、静岡県内の小・中・高校生を対象とした、次世代のITリーダーを発揮するためのステージです。\n\nプログラミングを通じて課題を解決したり、新しいエンターテインメントを生み出したりする創造力を募集しています。これまでの成果を披露し、多くの仲間と切磋琢磨しましょう。'
            },
            {
                category: 'CLASS_COMP',
                title: '部門紹介 (競技部門)',
                content: '対戦型プログラムを作成し、アルゴリズムや戦略を競い合う部門です。\n\n・U-16部門（15歳以下対象）：初心者から参加可能な対戦型プログラミングです。（初期状態で選択されます）\n・O-16部門（16歳以上対象）：より高度なアルゴリズムや多言語で競い合います。\n\n他者のコードと対戦させることで、より高度なロジックへの理解を深めます。'
            },
            {
                category: 'CLASS_WORK',
                title: '部門紹介 (作品部門)',
                content: '自由なアイデアでWebサイト、アプリ、ゲームなどを制作する部門です。技術的な完成度だけでなく、独創性や社会への有用性が評価されます。'
            }
        ];
        localStorage.setItem('mockFixedData', JSON.stringify(defaultFixed));
    }

    loadAllSubdivisions().then(() => {
        fetchQAData();
        fetchNewsData(); 
        fetchFixedData(); // Also load fixed content
    });
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
    
    renderSubdivisions(item.divisions || []);
    document.querySelectorAll('input[name="news-division"]').forEach(cb => {
        if (item.divisions) {
            if (cb.value === '競技部門') {
                const hasComp = item.divisions.includes('競技部門') || item.divisions.some(d => d.startsWith('競技部門 ('));
                cb.checked = hasComp;
            } else {
                cb.checked = item.divisions.includes(cb.value);
            }
        } else {
            cb.checked = false;
        }
    });
    syncCompSubdivisions();

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
                input.style.background = '#ffffff';
                input.style.border = '1px solid var(--primary-light)';
                input.style.borderRadius = '8px';
                input.style.color = 'var(--text-main)';
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
        renderSubdivisions(["競技部門 (U-16)"]);
        syncCompSubdivisions();

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
        renderSubdivisions(["競技部門 (U-16)"]);
        syncCompSubdivisions();
        
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

    const imageInputU16 = document.getElementById('class-comp-image-input-u16');
    if (imageInputU16) {
        imageInputU16.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('画像サイズは最大5MBまでです。');
                    e.target.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentClassCompImageU16 = e.target.result;
                    const previewContainer = document.getElementById('class-comp-image-preview-u16');
                    previewContainer.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = currentClassCompImageU16;
                    img.style.height = '100px';
                    img.style.borderRadius = '5px';
                    previewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const imageInputO16 = document.getElementById('class-comp-image-input-o16');
    if (imageInputO16) {
        imageInputO16.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('画像サイズは最大5MBまでです。');
                    e.target.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentClassCompImageO16 = e.target.result;
                    const previewContainer = document.getElementById('class-comp-image-preview-o16');
                    previewContainer.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = currentClassCompImageO16;
                    img.style.height = '100px';
                    img.style.borderRadius = '5px';
                    previewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    document.getElementById('fixed-form').addEventListener('submit', handleFixedSubmit);

    const addSnsBtn = document.getElementById('add-sns-account-btn');
    if (addSnsBtn) {
        addSnsBtn.addEventListener('click', () => addSnsAccountCard());
    }
}

let currentFixedImageBase64 = null;
let currentClassCompImageU16 = null;
let currentClassCompImageO16 = null;

function updateFixedFormVisibility() {
    const isAbout = currentFixedCategory === 'ABOUT';
    const isSNS = currentFixedCategory === 'SNS';
    const isClassComp = currentFixedCategory === 'CLASS_COMP';
    const isClassWork = currentFixedCategory === 'CLASS_WORK';
    const isStakeholders = currentFixedCategory === 'STAKEHOLDERS';
    
    document.querySelector('.field-fixed-title').style.display = (isSNS || isStakeholders || isClassComp) ? 'none' : 'block';
    document.querySelector('.field-fixed-content').style.display = (isSNS || isStakeholders || isClassComp) ? 'none' : 'block';
    
    document.querySelector('.field-fixed-image').style.display = isClassWork ? 'block' : 'none';
    document.querySelector('.field-fixed-link').style.display = isClassWork ? 'block' : 'none';
    
    document.querySelector('.field-fixed-sns').style.display = isSNS ? 'block' : 'none';
    document.querySelector('.field-fixed-stakeholders').style.display = isStakeholders ? 'block' : 'none';
    document.querySelector('.field-fixed-class-comp').style.display = isClassComp ? 'block' : 'none';
    
    if (isClassWork) {
        document.getElementById('fixed-content-label').textContent = "詳細 (改行・HTMLが反映されます)";
    } else {
        document.getElementById('fixed-content-label').textContent = "本文 / 詳細 (改行・HTMLが反映されます)";
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
    
    // Reset CLASS_COMP specific fields
    const classCompFields = [
        'class-comp-title-u16', 'class-comp-content-u16', 'class-comp-link-u16',
        'class-comp-title-o16', 'class-comp-content-o16', 'class-comp-link-o16'
    ];
    classCompFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const classCompPreviews = ['class-comp-image-preview-u16', 'class-comp-image-preview-o16'];
    classCompPreviews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const classCompInputs = ['class-comp-image-input-u16', 'class-comp-image-input-o16'];
    classCompInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentClassCompImageU16 = null;
    currentClassCompImageO16 = null;

    // Clear SNS accounts list
    const snsList = document.getElementById('sns-accounts-list');
    if (snsList) snsList.innerHTML = '';
    
    // Clear stakeholder lists
    ['主催', '共催', '協賛', '後援'].forEach(type => {
        const el = document.getElementById(`stakeholder-list-${type}`);
        if (el) el.innerHTML = '';
    });
    
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
                // sns_data is now an array of { service, id, link, comment }
                const accounts = Array.isArray(sns) ? sns : legacySnsToArray(sns);
                accounts.forEach(acc => addSnsAccountCard(acc));
            }
            
            // For CLASS_COMP, content holds JSON array of [{title, content, image, link}, ...]
            if (currentFixedCategory === 'CLASS_COMP' && data.content) {
                try {
                    const parsed = JSON.parse(data.content);
                    if (Array.isArray(parsed) && parsed.length >= 2) {
                        const u16 = parsed[0];
                        const o16 = parsed[1];
                        
                        document.getElementById('class-comp-title-u16').value = u16.title || '';
                        document.getElementById('class-comp-content-u16').value = u16.content || '';
                        document.getElementById('class-comp-link-u16').value = u16.link || '';
                        if (u16.image) {
                            currentClassCompImageU16 = u16.image;
                            const img = document.createElement('img');
                            img.src = u16.image;
                            img.style.height = '100px';
                            img.style.borderRadius = '5px';
                            document.getElementById('class-comp-image-preview-u16').appendChild(img);
                        }
                        
                        document.getElementById('class-comp-title-o16').value = o16.title || '';
                        document.getElementById('class-comp-content-o16').value = o16.content || '';
                        document.getElementById('class-comp-link-o16').value = o16.link || '';
                        if (o16.image) {
                            currentClassCompImageO16 = o16.image;
                            const img = document.createElement('img');
                            img.src = o16.image;
                            img.style.height = '100px';
                            img.style.borderRadius = '5px';
                            document.getElementById('class-comp-image-preview-o16').appendChild(img);
                        }
                    }
                } catch(e) {
                    console.error("Failed to parse CLASS_COMP json", e);
                }
            }

            // Stakeholders: stored as JSON in content field
            if (currentFixedCategory === 'STAKEHOLDERS' && data.content) {
                let stakeholders = data.content;
                if (typeof stakeholders === 'string') {
                    try { stakeholders = JSON.parse(stakeholders); } catch(e) { stakeholders = []; }
                }
                if (Array.isArray(stakeholders)) {
                    stakeholders.forEach(s => addStakeholderCard(s.type, s));
                }
            }
        }
    } catch (error) {
        console.error(error);

        // --- Fallback for local demo ONLY ---
        try {
            const localFixed = JSON.parse(localStorage.getItem('mockFixedData') || '[]');
            const data = localFixed.find(f => f.category === currentFixedCategory);
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
                    const accounts = Array.isArray(sns) ? sns : legacySnsToArray(sns);
                    accounts.forEach(acc => addSnsAccountCard(acc));
                }

                // For CLASS_COMP fallback
                if (currentFixedCategory === 'CLASS_COMP' && data.content) {
                    try {
                        const parsed = JSON.parse(data.content);
                        if (Array.isArray(parsed) && parsed.length >= 2) {
                            const u16 = parsed[0];
                            const o16 = parsed[1];
                            
                            document.getElementById('class-comp-title-u16').value = u16.title || '';
                            document.getElementById('class-comp-content-u16').value = u16.content || '';
                            document.getElementById('class-comp-link-u16').value = u16.link || '';
                            if (u16.image) {
                                currentClassCompImageU16 = u16.image;
                                const img = document.createElement('img');
                                img.src = u16.image;
                                img.style.height = '100px';
                                img.style.borderRadius = '5px';
                                document.getElementById('class-comp-image-preview-u16').appendChild(img);
                            }
                            
                            document.getElementById('class-comp-title-o16').value = o16.title || '';
                            document.getElementById('class-comp-content-o16').value = o16.content || '';
                            document.getElementById('class-comp-link-o16').value = o16.link || '';
                            if (o16.image) {
                                currentClassCompImageO16 = o16.image;
                                const img = document.createElement('img');
                                img.src = o16.image;
                                img.style.height = '100px';
                                img.style.borderRadius = '5px';
                                document.getElementById('class-comp-image-preview-o16').appendChild(img);
                            }
                        }
                    } catch(e) {
                        console.error("Failed to parse CLASS_COMP fallback json", e);
                    }
                }

                if (currentFixedCategory === 'STAKEHOLDERS' && data.content) {
                    let stakeholders = data.content;
                    if (typeof stakeholders === 'string') {
                        try { stakeholders = JSON.parse(stakeholders); } catch(e) { stakeholders = []; }
                    }
                    if (Array.isArray(stakeholders)) {
                        stakeholders.forEach(s => addStakeholderCard(s.type, s));
                    }
                }
            }
        } catch(e) {
            console.error("Local storage fixed content load failed", e);
        }
    }
}

// Convert old {insta:{}, x:{}, youtube:{}} format to new array format
function legacySnsToArray(sns) {
    const result = [];
    if (sns.insta && (sns.insta.id || sns.insta.link)) {
        result.push({ service: 'Instagram', id: sns.insta.id || '', link: sns.insta.link || '', comment: '' });
    }
    if (sns.x && (sns.x.id || sns.x.link)) {
        result.push({ service: 'X (旧Twitter)', id: sns.x.id || '', link: sns.x.link || '', comment: '' });
    }
    if (sns.youtube && (sns.youtube.id || sns.youtube.link)) {
        result.push({ service: 'YouTube', id: sns.youtube.id || '', link: sns.youtube.link || '', comment: '' });
    }
    return result;
}

function addSnsAccountCard(data = {}) {
    const list = document.getElementById('sns-accounts-list');
    if (!list) return;

    const idx = list.children.length;
    const card = document.createElement('div');
    card.dataset.snsCard = idx;
    card.style.cssText = 'background: #ffffff; border: 2px solid var(--primary-light); border-radius: 12px; padding: 20px; position: relative; box-shadow: 0 2px 8px rgba(26,123,196,0.06);';

    card.innerHTML = `
        <button type="button" onclick="this.closest('[data-sns-card]').remove()" 
            style="position: absolute; top: 15px; right: 15px; background: rgba(214, 48, 49, 0.1); border: 1px solid rgba(214, 48, 49, 0.2); color: #d63031; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">削除</button>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 5px;">
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-dim);">サービス名 (例: Instagram, X, YouTube など)</label>
                <input type="text" class="sns-field-service" value="${data.service || ''}" placeholder="Instagram" 
                    style="width: 100%; padding: 10px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-family: inherit;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-dim);">ユーザーID (@を含めて入力)</label>
                <input type="text" class="sns-field-id" value="${data.id || ''}" placeholder="@u16_procon" 
                    style="width: 100%; padding: 10px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-family: inherit;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-dim);">リンクURL</label>
                <input type="url" class="sns-field-url" value="${data.link || ''}" placeholder="https://x.com/u16_procon" 
                    style="width: 100%; padding: 10px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-family: inherit;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-dim);">コメント (HP上での補足説明)</label>
                <input type="text" class="sns-field-comment" value="${data.comment || ''}" placeholder="最新情報を発信中！" 
                    style="width: 100%; padding: 10px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-family: inherit;">
            </div>
        </div>
    `;
    list.appendChild(card);
}

function getSnsAccountsFromForm() {
    const cards = document.querySelectorAll('#sns-accounts-list [data-sns-card]');
    const result = [];
    cards.forEach(card => {
        const service = card.querySelector('.sns-field-service').value.trim();
        const id = card.querySelector('.sns-field-id').value.trim();
        const link = card.querySelector('.sns-field-url').value.trim();
        const comment = card.querySelector('.sns-field-comment').value.trim();
        if (service || id || link) {
            result.push({ service, id, link, comment });
        }
    });
    return result;
}

function addStakeholderCard(type, data = {}) {
    const list = document.getElementById('stakeholder-list-' + type);
    if (!list) return;

    const idx = Date.now();
    const card = document.createElement('div');
    card.dataset.stakeholderCard = idx;
    card.dataset.stakeholderType = type;
    card.style.cssText = 'background: #ffffff; border: 2px solid var(--primary-light); border-radius: 12px; padding: 15px; display: flex; gap: 10px; align-items: center; position: relative; box-shadow: 0 2px 8px rgba(26,123,196,0.06);';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 8px;';

    // Name field
    const nameDiv = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.style.cssText = 'display: block; margin-bottom: 3px; font-size: 0.8rem; color: var(--text-dim);';
    nameLabel.innerHTML = '会社・団体名 <span style="color: #ff8080;">*必須</span>';
    nameDiv.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'stakeholder-field-name';
    nameInput.value = data.name || '';
    nameInput.placeholder = '例：静岡県';
    nameInput.required = true;
    nameInput.style.cssText = 'width: 100%; padding: 9px 12px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-size: 0.95rem; font-family: inherit;';
    nameDiv.appendChild(nameInput);
    wrapper.appendChild(nameDiv);

    // URL field
    const urlDiv = document.createElement('div');
    const urlLabel = document.createElement('label');
    urlLabel.style.cssText = 'display: block; margin-bottom: 3px; font-size: 0.8rem; color: var(--text-dim);';
    urlLabel.innerHTML = 'URL <span style="font-size: 0.75rem;">(任意)</span>';
    urlDiv.appendChild(urlLabel);
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'stakeholder-field-url';
    urlInput.value = data.url || '';
    urlInput.placeholder = 'https://example.com';
    urlInput.style.cssText = 'width: 100%; padding: 9px 12px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-size: 0.95rem; font-family: inherit;';
    urlDiv.appendChild(urlInput);
    wrapper.appendChild(urlDiv);

    card.appendChild(wrapper);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '削除';
    delBtn.style.cssText = 'align-self: center; background: rgba(214, 48, 49, 0.1); border: 1px solid rgba(214, 48, 49, 0.2); color: #d63031; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 0.8rem; font-weight: 600; white-space: nowrap;';
    delBtn.addEventListener('click', () => card.remove());
    card.appendChild(delBtn);

    list.appendChild(card);
}

function getStakeholdersFromForm() {
    const types = ['主催', '共催', '協賛', '後援'];
    const result = [];
    types.forEach(type => {
        const list = document.getElementById('stakeholder-list-' + type);
        if (!list) return;
        const cards = list.querySelectorAll('[data-stakeholder-card]');
        cards.forEach(card => {
            const name = card.querySelector('.stakeholder-field-name').value.trim();
            const url = card.querySelector('.stakeholder-field-url').value.trim();
            if (name) result.push({ type, name, url });
        });
    });
    return result;
}

async function handleFixedSubmit(e) {
    e.preventDefault();

    const category = currentFixedCategory;
    const statusMsg = document.getElementById('fixed-status');

    let title = null;
    let link = null;
    let image = null;
    let content = null;

    if (category === 'STAKEHOLDERS') {
        const stakeholders = getStakeholdersFromForm();
        if (stakeholders.length === 0) {
            alert('\u5C11\u306A\u304F\u3068\u30821\u4EF6\u306E\u56E3\u4F53\u30FB\u4F1A\u793E\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002');
            return;
        }
        content = JSON.stringify(stakeholders);
    } else if (category === 'CLASS_COMP') {
        const u16 = {
            title: document.getElementById('class-comp-title-u16').value.trim() || 'U-16部門',
            content: document.getElementById('class-comp-content-u16').value.trim(),
            link: document.getElementById('class-comp-link-u16').value.trim(),
            image: currentClassCompImageU16
        };
        const o16 = {
            title: document.getElementById('class-comp-title-o16').value.trim() || 'O-16部門',
            content: document.getElementById('class-comp-content-o16').value.trim(),
            link: document.getElementById('class-comp-link-o16').value.trim(),
            image: currentClassCompImageO16
        };
        content = JSON.stringify([u16, o16]);
    } else {
        title = document.getElementById('fixed-title').value;
        content = document.getElementById('fixed-content').value;
        link = document.getElementById('fixed-link').value;
        image = currentFixedImageBase64;
    }

    const sns_data = getSnsAccountsFromForm();

    const payload = { 
        category, 
        title, 
        content,
        link,
        image,
        sns_data
    };

    try {
        const response = await fetch('/api/fixed', {
            method: 'POST', // The backend upserts
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to save fixed content');
        }
        
        statusMsg.textContent = '\u5185\u5BB9\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F\u3002';
        statusMsg.className = 'status-msg success';
        statusMsg.style.display = 'block';

        // Also persist to localStorage for local fallback
        try {
            let localFixed = JSON.parse(localStorage.getItem('mockFixedData') || '[]');
            const idx = localFixed.findIndex(f => f.category === category);
            const record = idx > -1 ? { ...localFixed[idx], ...payload } : { ...payload };
            if (idx > -1) localFixed[idx] = record;
            else localFixed.push(record);
            localStorage.setItem('mockFixedData', JSON.stringify(localFixed));
        } catch(e) { /* ignore localStorage errors */ }
        
        setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
        await fetchFixedData(); 
    } catch (error) {
        console.error(error);
        // Show detailed error from server if available
        let errorDetail = '保存に失敗しました。';
        if (error.message && error.message !== 'Failed to save fixed content') {
            errorDetail += ' (' + error.message + ')';
        }
        statusMsg.textContent = errorDetail;
        statusMsg.className = 'status-msg error';
        statusMsg.style.display = 'block';
    }
}
