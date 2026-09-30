// data: URI(base64)のPDFをそのままhrefにすると、数MBの巨大なURLになりブラウザのURL長制限に
// 引っかかって白紙タブが開いてしまう(Chrome等で実測で再現する挙動)。blob: URLに変換して回避する。
// main.js側にも同名の関数があるが、こちらは管理画面(admin.js)専用の別ファイルなので複製している。
function dataUrlToBlobUrl(dataUrl) {
    try {
        const commaIndex = dataUrl.indexOf(',');
        const header = dataUrl.slice(0, commaIndex);
        const base64 = dataUrl.slice(commaIndex + 1);
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const blob = new Blob([bytes], { type: mime });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error('Failed to convert PDF data URL to a blob URL', e);
        return dataUrl;
    }
}

// 送信ボタンを処理中だけ無効化し、連打による二重送信を防ぐ。処理中にもう一度呼ばれても何もしない。
async function runWithButtonLock(button, busyText, task) {
    if (!button) return task();
    if (button.disabled) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
    try {
        return await task();
    } finally {
        button.disabled = false;
        // 処理の中でボタン文言が変わった場合(「更新する」→「投稿する」等)はそちらを優先する
        if (button.textContent === busyText) button.textContent = originalText;
    }
}

// Vercelのサーバーレス関数はリクエスト本文が約4.5MBを超えると受け付けないため、送信前に確認する
const MAX_REQUEST_BODY_LENGTH = 4.3 * 1024 * 1024;

// 画像アップロード欄(PDF/JPEG/PNG)共通の処理。PDFは1ページ目を画像に変換してから onLoaded に渡す。
function bindImageUpload(input, onLoaded) {
    if (!input) return;
    input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        try {
            const images = [];
            for (const file of files) images.push(await readUploadAsImage(file));
            onLoaded(images);
        } catch (err) {
            console.error(err);
            alert(err.message || '画像の読み込みに失敗しました。');
            e.target.value = '';
        }
    });
}

function showImagePreview(container, src, height = '100px') {
    const img = document.createElement('img');
    img.src = src;
    img.style.height = height;
    img.style.borderRadius = '5px';
    container.appendChild(img);
    // 以前PDFのまま保存された画像も表示できるようにする
    renderPdfImages(container);
}

document.addEventListener('DOMContentLoaded', () => {
    // Check login state (simple session storage)
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
        showAdminPanel();
    }

    // サイドメニューの切り替えロジック
    document.querySelectorAll('#admin-sidebar-nav button[data-section]').forEach(btn => {
        btn.addEventListener('click', () => switchAdminSection(btn.dataset.section));
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
    document.getElementById('qa-form').addEventListener('submit', (e) => {
        e.preventDefault();
        runWithButtonLock(document.getElementById('qa-submit-btn'), '保存中...', () => handleFormSubmit(e));
    });

    // News Event Listeners
    initNewsLogic();

    // Fixed Content Event Listeners
    initFixedLogic();

    // 規約・ポリシーPDFのEvent Listeners
    initPolicyLogic();
});

// ======================
// サイドメニュー セクション切り替え
// ======================
const ADMIN_SECTIONS = {
    'dashboard':           { panel: 'panel-dashboard' },
    'qa':                  { panel: 'panel-qa' },
    'news-notice':         { panel: 'panel-news', newsCategory: 'お知らせ', target: 'HOMEページ「お知らせ・最新情報」に表示されます' },
    'news-current':        { panel: 'panel-news', newsCategory: '今期の開催情報', target: '開催情報ページ「今期の開催情報」タブに表示されます' },
    'news-past':           { panel: 'panel-news', newsCategory: '過去の開催情報', target: '開催情報ページ「過去の開催情報」タブに表示されます(今期からのアーカイブ移行もここで操作)' },
    'fixed-about':         { panel: 'panel-fixed', fixedCategory: 'ABOUT', label: 'ABOUT (大会について)', target: '大会についてページ上部の概要文に表示されます' },
    'fixed-class-comp':    { panel: 'panel-fixed', fixedCategory: 'CLASS_COMP', label: '競技部門', target: '大会についてページ「部門紹介」内、競技部門カードに表示されます' },
    'fixed-class-work':    { panel: 'panel-fixed', fixedCategory: 'CLASS_WORK', label: '作品部門', target: '大会についてページ「部門紹介」内、作品部門カードに表示されます' },
    'fixed-tools':         { panel: 'panel-fixed', fixedCategory: 'TOOLS', label: 'ツール紹介', target: '大会についてページ「ツール紹介」セクションに表示されます' },
    'fixed-sns':           { panel: 'panel-fixed', fixedCategory: 'SNS', label: 'SNS', target: '共有情報：HOMEページに表示されます(1件以上登録すると自動的に表示され、0件なら自動的に非表示になります)' },
    'fixed-stakeholders':  { panel: 'panel-fixed', fixedCategory: 'STAKEHOLDERS', label: 'スポンサー (主催・共催・協賛・後援)', target: 'スポンサーページにグループごとに表示されます' },
    'terms':               { panel: 'panel-terms' },
    'privacy':             { panel: 'panel-privacy' },
};

function switchAdminSection(section) {
    const cfg = ADMIN_SECTIONS[section];
    if (!cfg) return;

    document.querySelectorAll('#admin-sidebar-nav button[data-section]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });

    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    const panelEl = document.getElementById(cfg.panel);
    if (panelEl) panelEl.classList.add('active');

    if (cfg.newsCategory) {
        currentNewsCategory = cfg.newsCategory;
        const titleEl = document.getElementById('news-panel-title');
        if (titleEl) titleEl.textContent = cfg.newsCategory === '過去の開催情報' ? '記事投稿 (過去の開催情報アーカイブ)' : '記事投稿 (' + cfg.newsCategory + ')';
        const displayCat = document.getElementById('current-news-category');
        if (displayCat) displayCat.textContent = cfg.newsCategory;
        const listCat = document.getElementById('news-list-category');
        if (listCat) listCat.textContent = cfg.newsCategory;
        const targetEl = document.getElementById('news-panel-target');
        if (targetEl) targetEl.textContent = cfg.target || '';

        updateNewsFormVisibility(cfg.newsCategory);

        document.getElementById('news-form').reset();
        currentImagesBase64 = [];
        document.getElementById('image-preview-container').innerHTML = '';
        currentPosterBase64 = null;
        document.getElementById('poster-preview-container').innerHTML = '';

        document.getElementById('news-id').value = '';
        document.getElementById('news-submit-btn').textContent = cfg.newsCategory === '過去の開催情報' ? '過去の大会としてアーカイブする' : '投稿する';
        document.getElementById('news-cancel-btn').style.display = 'none';
        renderSubdivisions(["競技部門 (U-16)"]);
        syncCompSubdivisions();
        fetchNewsData();
    }

    if (cfg.fixedCategory) {
        currentFixedCategory = cfg.fixedCategory;
        const displayCat = document.getElementById('current-fixed-category');
        if (displayCat) displayCat.textContent = cfg.label || cfg.fixedCategory;
        const targetEl = document.getElementById('fixed-panel-target');
        if (targetEl) targetEl.textContent = cfg.target || '';
        fetchFixedData(); // 内部でupdateFixedFormVisibility()も呼ばれる
    }

    if (section === 'qa') fetchQAData();
    if (section === 'terms') fetchPolicyPdf('terms');
    if (section === 'privacy') fetchPolicyPdf('privacy');
}

let currentNewsCategory = 'お知らせ';
let currentFixedCategory = 'ABOUT';
let currentImagesBase64 = [];
let currentPosterBase64 = null;

// 現在HPに直書きされている「今すぐエントリー」リンク。entry_url未設定(=まだ一度も編集されていない)の場合、
// フォームにはHPの表示と差異が出ないよう、この値を編集前情報として表示する。main.js側の既定値と揃えること。
const DEFAULT_COMP_ENTRY_URL = 'https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/entry';
const DEFAULT_WORK_ENTRY_URL = 'https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/works';

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

    // HPと同じく、ポスター画像を一番上に、その下に詳細情報を表示する
    let previewHTML = '';
    if (currentPosterBase64) {
        previewHTML += `<img src="${currentPosterBase64}" style="width: 100%; max-width: 400px; display: block; margin: 0 auto 15px; border-radius: 12px;">`;
    }

    previewHTML += `<h2 style="color: var(--primary); margin-bottom: 10px;">${title}</h2>`;

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
    renderPdfImages(document.getElementById('preview-container'));
    document.getElementById('preview-modal').classList.add('active');
}

function showFixedPreview() {
    const category = currentFixedCategory;
    let previewHTML = '';
    
    if (category === 'CLASS_COMP') {
        const u16Content = document.getElementById('class-comp-content-u16').value || '';
        const u16Link = document.getElementById('class-comp-link-u16').value || '';
        const u16Img = currentClassCompImageU16;

        const imgHtmlU16 = u16Img ? `<img src="${u16Img}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 10px; margin-top: 10px;">` : '';
        const linkHtmlU16 = u16Link ? `<div style="margin-top: 12px;"><a href="${u16Link}" target="_blank" class="btn-outline" style="padding: 6px 14px; font-size: 0.8rem; border-width: 1.5px; display: inline-block;">もっと詳しく</a></div>` : '';

        previewHTML = `
            <h2 style="color: var(--primary); margin-bottom: 20px;">部門紹介 (競技部門) プレビュー</h2>
            <div style="max-width: 400px; background: rgba(26, 123, 196, 0.05); padding: 15px; border-radius: 16px; border: 1px solid var(--glass-border); text-align: left; color: var(--text-main);">
                <h4 style="color: var(--primary); font-weight: 800; margin-bottom: 8px; font-size: 0.95rem; line-height: 1.3;">
                    <span style="display: flex; align-items: center; gap: 4px;">👦 U-16部門</span>
                    <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-dim); display: block; margin-top: 2px;">(16歳以下対象)</span>
                </h4>
                <div style="white-space: pre-wrap; line-height: 1.5; font-size: 0.85rem;">${u16Content}</div>
                ${imgHtmlU16}
                ${linkHtmlU16}
            </div>
        `;
    } else if (category === 'CLASS_WORK') {
        const workContent = document.getElementById('class-work-content').value || '';
        const workLink = document.getElementById('class-work-link').value || '';
        const workTitle = document.getElementById('fixed-title').value || '作品部門';

        const imgHtml = currentClassWorkImage ? `<img src="${currentClassWorkImage}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 10px; margin-top: 10px;">` : '';
        const linkHtml = workLink ? `<div style="margin-top: 12px;"><a href="${workLink}" target="_blank" class="btn-outline" style="padding: 6px 14px; font-size: 0.8rem; border-width: 1.5px; display: inline-block;">もっと詳しく</a></div>` : '';

        previewHTML = `
            <h2 style="color: var(--primary); margin-bottom: 20px;">部門紹介 (作品部門) プレビュー</h2>
            <div style="max-width: 400px; background: rgba(26, 123, 196, 0.05); padding: 15px; border-radius: 16px; border: 1px solid var(--glass-border); text-align: left; color: var(--text-main);">
                <h4 style="color: var(--primary); font-weight: 800; margin-bottom: 8px; font-size: 0.95rem; line-height: 1.3;">🎨 ${workTitle}</h4>
                <div style="white-space: pre-wrap; line-height: 1.5; font-size: 0.85rem;">${workContent}</div>
                ${imgHtml}
                ${linkHtml}
            </div>
        `;
    } else if (category === 'STAKEHOLDERS') {
        const stakeholders = getStakeholdersFromForm();
        previewHTML = `<h2 style="color: var(--primary); margin-bottom: 20px;">スポンサー プレビュー</h2>`;
        if (stakeholders.length > 0) {
            const order = ['主催', '共催', '協賛', '後援'];
            const groups = {};
            stakeholders.forEach(s => {
                if (!groups[s.type]) groups[s.type] = [];
                groups[s.type].push(s);
            });
            order.forEach(type => {
                if (!groups[type] || groups[type].length === 0) return;
                previewHTML += `<h4 style="color: var(--primary); margin: 15px 0 10px;">${type}</h4>`;
                previewHTML += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; margin-bottom: 10px;">`;
                groups[type].forEach(s => {
                    const frameHeight = s.size === 'large' ? '120px' : '60px';
                    const logoHtml = s.logo
                        ? `<img src="${s.logo}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                        : `<span style="color: var(--primary); font-weight: 800; font-size: 1.3rem;">${(s.name || '?').charAt(0)}</span>`;
                    previewHTML += `
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: white; border: 1px solid var(--glass-border); border-radius: 10px; padding: 8px; box-sizing: border-box;">
                                <div style="max-height: ${frameHeight}; display: flex; align-items: center; justify-content: center;">${logoHtml}</div>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-main); margin-top: 6px; font-weight: 600;">${s.name}${s.size === 'large' ? ' 🌟' : ''}</div>
                        </div>
                    `;
                });
                previewHTML += `</div>`;
            });
        } else {
            previewHTML += `<p style="color: var(--text-dim);">（スポンサー未登録）</p>`;
        }
    } else if (category === 'TOOLS') {
        const tools = getToolsFromForm();
        previewHTML = `<h2 style="color: var(--primary); margin-bottom: 20px;">ツール紹介 プレビュー</h2>`;
        if (tools.length > 0) {
            previewHTML += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; color: var(--text-main);">`;
            tools.forEach(tool => {
                const titleHtml = tool.url 
                    ? `<h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;"><a href="${tool.url}" target="_blank" style="color: var(--primary); text-decoration: none;">${tool.name} 🔗</a></h3>` 
                    : `<h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${tool.name}</h3>`;
                previewHTML += `
                    <div style="background: rgba(26, 123, 196, 0.05); padding: 20px; border-radius: 16px; border: 1px solid var(--glass-border); text-align: left;">
                        ${titleHtml}
                        <p style="color: var(--text-dim); font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; margin: 0;">${tool.description}</p>
                    </div>
                `;
            });
            previewHTML += `</div>`;
        } else {
            previewHTML += `<p style="color: var(--text-dim);">（ツール未登録）</p>`;
        }
    } else {
        const title = document.getElementById('fixed-title').value || '（見出し未入力）';
        const content = document.getElementById('fixed-content').value || '';
        
        previewHTML = `<h2 style="color: var(--primary); margin-bottom: 15px;">${title}</h2>`;
        previewHTML += `<div style="white-space: pre-wrap; line-height: 1.6;">${content}</div>`;
    }
    
    document.getElementById('preview-container').innerHTML = previewHTML;
    renderPdfImages(document.getElementById('preview-container'));
    document.getElementById('preview-modal').classList.add('active');
}

function initNewsLogic() {
    updateNewsFormVisibility(currentNewsCategory);

    // カテゴリの切り替えはサイドメニュー(switchAdminSection)が担うため、ここでは不要

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

    bindImageUpload(document.getElementById('news-image-input'), (images) => {
        const maxFiles = currentNewsCategory === '過去の開催情報' ? 5 : 1;
        currentImagesBase64 = images.slice(0, maxFiles);
        const previewContainer = document.getElementById('image-preview-container');
        previewContainer.innerHTML = '';
        currentImagesBase64.forEach(src => showImagePreview(previewContainer, src, '60px'));
    });

    bindImageUpload(document.getElementById('news-poster-input'), ([image]) => {
        currentPosterBase64 = image;
        const previewContainer = document.getElementById('poster-preview-container');
        previewContainer.innerHTML = '';
        showImagePreview(previewContainer, image);
    });

    document.getElementById('news-form').addEventListener('submit', (e) => {
        e.preventDefault();
        runWithButtonLock(document.getElementById('news-submit-btn'), '送信中...', () => handleNewsSubmit(e));
    });
    document.getElementById('news-cancel-btn').addEventListener('click', () => {
        document.getElementById('news-form').reset();
        currentImagesBase64 = [];
        document.getElementById('image-preview-container').innerHTML = '';
        currentPosterBase64 = null;
        document.getElementById('poster-preview-container').innerHTML = '';
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

    // DBの部門一覧の読み込みは showAdminPanel() → refreshSubdivisions() が行う(ここでは既定の選択肢で描画しておく)
    renderSubdivisions(["競技部門 (U-16)"]);
    syncCompSubdivisions();
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
                title: '競技部門',
                content: '対戦型プログラムを作成し、アルゴリズムや戦略を競い合う部門です。\n\nU-16部門（16歳以下対象）：初心者から参加可能な対戦型プログラミングです。\n\n他者のコードと対戦させることで、より高度なロジックへの理解を深めます。',
                entry_url: DEFAULT_COMP_ENTRY_URL
            },
            {
                category: 'CLASS_WORK',
                title: '作品部門',
                content: '自由なアイデアでWebサイト、アプリ、ゲームなどを制作する部門です。技術的な完成度だけでなく、独創性や社会への有用性が評価されます。',
                entry_url: DEFAULT_WORK_ENTRY_URL
            },
            {
                category: 'TOOLS',
                title: 'ツール紹介',
                content: JSON.stringify([
                    { name: 'Blockly Chaser', url: 'https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/', description: '競技部門で使用する対戦型プログラミングツールです。ブロックを組み合わせてプログラムを作成し、他のプレイヤーと対戦できます。' }
                ])
            }
        ];
        localStorage.setItem('mockFixedData', JSON.stringify(defaultFixed));
    }

    // ログイン後、最初に表示するページ(HPのHOMEに相当)。
    // 部門一覧の読み込み完了を待ってから切り替えると、全記事(画像込みで数MB)の取得に数秒かかる間に
    // 別の項目で入力を始めていた場合でも強制的にダッシュボードへ戻され、入力内容が消えてしまうため、先に切り替える。
    switchAdminSection('dashboard');
    refreshSubdivisions();
}

// 部門の選択肢をDBの内容で更新する。読み込みには時間がかかるため、完了時点のチェック状態を保ったまま選択肢だけ差し替える。
async function refreshSubdivisions() {
    await loadAllSubdivisions();
    const checked = Array.from(document.querySelectorAll('input[name="news-division"]:checked')).map(cb => cb.value);
    renderSubdivisions(checked);
    syncCompSubdivisions();
}

let qaData = [];
let newsData = [];

function updateNewsFormVisibility(category) {
    const isCurrent = category === '今期の開催情報';
    const isPast = category === '過去の開催情報';
    const isNotice = category === 'お知らせ';

    const s = sel => document.querySelector(sel).style;

    // 「他所での開催」カテゴリは廃止のため、開催都道府県は常時非表示
    s('.field-prefecture').display = 'none';
    // 「詳細を見る」ボタン用URL(overview_url)は今期の開催情報でも公開側が表示に使うため、ここで入力できるようにする
    s('.field-overview-url').display = isCurrent ? 'block' : 'none';

    s('.field-dates').display = isCurrent ? 'block' : 'none';
    s('#news-auto-migrate-text').display = isCurrent ? 'inline' : 'none';
    s('.field-time-tentative').display = 'block';

    s('.field-location').display = isCurrent ? 'block' : 'none';
    s('.field-map-url').display = isCurrent ? 'block' : 'none';
    s('.field-application').display = isCurrent ? 'block' : 'none';

    // 参加人数は「過去の記録」として値を残すための項目なので、アーカイブ時のみ入力欄を出す
    s('.field-participants-group').display = (isCurrent || isPast) ? 'flex' : 'none';
    s('.field-target-age').display = isCurrent ? 'block' : 'none';
    s('.field-participants').display = isPast ? 'block' : 'none';

    s('.field-divisions').display = isCurrent ? 'block' : 'none';
    s('.field-poster').display = isCurrent ? 'block' : 'none';
    s('.field-image').display = (isCurrent || isPast) ? 'block' : 'none';

    const contentLabel = document.getElementById('news-content-label');
    const imageLabel = document.getElementById('news-image-label');
    const imageInput = document.getElementById('news-image-input');

    if (isNotice && contentLabel) contentLabel.textContent = '本文';
    else if (contentLabel) contentLabel.textContent = '概要';

    if (imageLabel && imageInput) {
        if (isPast) {
            imageLabel.innerHTML = '大会の様子（画像5枚まで） <span style="font-size: 0.8rem; color: var(--text-dim);">※最大5MB程度まで</span>';
            imageInput.multiple = true;
        } else {
            imageLabel.innerHTML = '画像投稿（1枚） <span style="font-size: 0.8rem; color: var(--text-dim);">※最大5MB程度まで</span>';
            imageInput.multiple = false;
        }
    }

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

        if (response.status === 409) {
            const errData = await response.json().catch(() => ({}));
            alert(errData.error || '直前の登録と同じ内容のため、登録しませんでした。');
            return;
        }
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
    currentImagesBase64.forEach(src => showImagePreview(previewContainer, src, '60px'));

    currentPosterBase64 = item.poster_image || null;
    const posterPreviewContainer = document.getElementById('poster-preview-container');
    posterPreviewContainer.innerHTML = '';
    if (currentPosterBase64) showImagePreview(posterPreviewContainer, currentPosterBase64);

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

    let start_date = document.getElementById('news-start-date').value || null;
    let start_time = document.getElementById('news-start-time').value || null;
    let end_time = document.getElementById('news-end-time').value || null;
    let is_tentative = document.getElementById('news-is-tentative').checked;
    let location = document.getElementById('news-location').value || null;
    let map_url = document.getElementById('news-map-url').value || null;
    let application_url = document.getElementById('news-application-url').value || null;
    let overview_url = document.getElementById('news-overview-url').value || null;
    const prefecture = document.getElementById('news-prefecture').value || null;
    let target_age = document.getElementById('news-target-age').value || null;
    const participants = document.getElementById('news-participants').value || null;

    const divCheckboxes = document.querySelectorAll('input[name="news-division"]:checked');
    let divisions = Array.from(divCheckboxes).map(cb => cb.value);

    const commentsTextareas = document.querySelectorAll('.news-participant-comment');
    let participant_comments = Array.from(commentsTextareas).map(ta => ta.value).filter(v => v.trim() !== '');
    if (participant_comments.length === 0) participant_comments = null;

    let images = currentImagesBase64.length > 0 ? currentImagesBase64 : null;
    let poster_image = currentPosterBase64;
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
            poster_image = item.poster_image; // retain existing poster image
            // アーカイブ時はフォームの日時・場所・URL等の入力欄が隠れているため、
            // 元の記事の値をそのまま引き継ぐ(そうしないと空欄で上書きされて消えてしまう)
            start_date = item.start_date || null;
            start_time = item.start_time || null;
            end_time = item.end_time || null;
            is_tentative = item.is_tentative || false;
            location = item.location || null;
            map_url = item.map_url || null;
            application_url = item.application_url || null;
            overview_url = item.overview_url || null;
            target_age = item.target_age || null;
            divisions = item.divisions || [];
            // participants(参加人数)はアーカイブ時に新しく入力する値をそのまま使う
        }
    } else {
        past_images = null;
    }

    const method = id && currentNewsCategory !== '過去の開催情報' ? 'PUT' : (currentNewsCategory === '過去の開催情報' ? 'PUT' : 'POST');
    const payload = {
        id, category, title, content,
        start_date, start_time, end_time, is_tentative, location, map_url, application_url, overview_url, prefecture,
        target_age, participants, divisions, images, poster_image, past_images, is_past, participant_comments
    };

    // 同じ内容の連続投稿を防ぐ(サーバー側でも同じチェックを行う)
    if (method === 'POST') {
        const latest = newsData[0];
        if (latest && latest.title === title && (latest.content || '') === (content || '')) {
            alert('直前の投稿と同じ内容のため、投稿しませんでした。');
            return;
        }
    }

    const body = JSON.stringify(payload);
    if (body.length > MAX_REQUEST_BODY_LENGTH) {
        alert('画像の合計サイズが大きすぎるため送信できません。画像の枚数を減らすか、小さい画像を選択してください。');
        return;
    }

    try {
        const response = await fetch('/api/news', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body
        });

        if (response.status === 409) {
            const errData = await response.json().catch(() => ({}));
            alert(errData.error || '直前の投稿と同じ内容のため、投稿しませんでした。');
            return;
        }
        if (!response.ok) throw new Error('Failed to save news data');

        document.getElementById('news-form').reset();
        currentImagesBase64 = [];
        document.getElementById('image-preview-container').innerHTML = '';
        currentPosterBase64 = null;
        document.getElementById('poster-preview-container').innerHTML = '';
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
        alert('DBへの保存に失敗したため、ブラウザ内に一時保存しました(公開サイトには反映されていません)。\n(' + (error.message || 'エラー') + ')');

        document.getElementById('news-form').reset();
        currentImagesBase64 = [];
        document.getElementById('image-preview-container').innerHTML = '';
        currentPosterBase64 = null;
        document.getElementById('poster-preview-container').innerHTML = '';
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
    // カテゴリの切り替えはサイドメニュー(switchAdminSection)が担うため、ここでは不要

    bindImageUpload(document.getElementById('class-comp-image-input-u16'), ([image]) => {
        currentClassCompImageU16 = image;
        const previewContainer = document.getElementById('class-comp-image-preview-u16');
        previewContainer.innerHTML = '';
        showImagePreview(previewContainer, image);
    });

    bindImageUpload(document.getElementById('class-work-image-input'), ([image]) => {
        currentClassWorkImage = image;
        const previewContainer = document.getElementById('class-work-image-preview');
        previewContainer.innerHTML = '';
        showImagePreview(previewContainer, image);
    });

    document.getElementById('fixed-form').addEventListener('submit', (e) => {
        e.preventDefault();
        runWithButtonLock(document.getElementById('fixed-submit-btn'), '保存中...', () => handleFixedSubmit(e));
    });

    const addSnsBtn = document.getElementById('add-sns-account-btn');
    if (addSnsBtn) {
        addSnsBtn.addEventListener('click', () => addSnsAccountCard());
    }

    const addToolBtn = document.getElementById('add-tool-btn');
    if (addToolBtn) {
        addToolBtn.addEventListener('click', () => addToolCard());
    }
}

let currentClassCompImageU16 = null;
let currentClassWorkImage = null;

function updateFixedFormVisibility() {
    const isSNS = currentFixedCategory === 'SNS';
    const isClassComp = currentFixedCategory === 'CLASS_COMP';
    const isClassWork = currentFixedCategory === 'CLASS_WORK';
    const isStakeholders = currentFixedCategory === 'STAKEHOLDERS';
    const isTools = currentFixedCategory === 'TOOLS';
    const usesGenericFields = !(isSNS || isStakeholders || isClassComp || isClassWork || isTools);

    document.querySelector('.field-fixed-title').style.display = usesGenericFields ? 'block' : 'none';
    document.querySelector('.field-fixed-content').style.display = usesGenericFields ? 'block' : 'none';

    document.querySelector('.field-fixed-sns').style.display = isSNS ? 'block' : 'none';
    document.querySelector('.field-fixed-stakeholders').style.display = isStakeholders ? 'block' : 'none';
    document.querySelector('.field-fixed-class-comp').style.display = isClassComp ? 'block' : 'none';
    document.querySelector('.field-fixed-class-work').style.display = isClassWork ? 'block' : 'none';
    document.querySelector('.field-fixed-tools').style.display = isTools ? 'block' : 'none';
}

function resetFixedForm() {
    ['fixed-id', 'fixed-title', 'fixed-content',
     'class-comp-content-u16', 'class-comp-link-u16', 'class-comp-image-input-u16',
     'class-work-content', 'class-work-link', 'class-work-image-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['class-comp-image-preview-u16', 'class-work-image-preview', 'sns-accounts-list', 'tools-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    ['主催', '共催', '協賛', '後援'].forEach(type => {
        const el = document.getElementById(`stakeholder-list-${type}`);
        if (el) el.innerHTML = '';
    });

    // データが1件も無い(=セットアップ前)場合でも、HPの表示と差異が出ないよう既定URL・表示ONを出しておく
    document.getElementById('class-comp-entry-url-u16').value = DEFAULT_COMP_ENTRY_URL;
    document.getElementById('class-work-entry-url').value = DEFAULT_WORK_ENTRY_URL;
    document.getElementById('class-comp-entry-enabled').checked = true;
    document.getElementById('class-work-entry-enabled').checked = true;

    currentClassCompImageU16 = null;
    currentClassWorkImage = null;
}

// 取得した固定コンテンツ1件をフォームに反映する(DB取得時・ローカル保存フォールバック時の共通処理)
function populateFixedForm(category, data) {
    document.getElementById('fixed-id').value = data.id || '';
    document.getElementById('fixed-title').value = data.title || '';
    document.getElementById('fixed-content').value = data.content || '';

    if (data.sns_data) {
        let sns = data.sns_data;
        if (typeof sns === 'string') sns = JSON.parse(sns);
        // sns_data is now an array of { service, id, link, comment }
        const accounts = Array.isArray(sns) ? sns : legacySnsToArray(sns);
        accounts.forEach(acc => addSnsAccountCard(acc));
    }

    // For CLASS_COMP, content holds JSON array of [{content, image, link}, ...] (U-16のみ使用。旧データにO-16分の2要素目が残っていても無視する)
    if (category === 'CLASS_COMP') {
        // 未編集(entry_url未設定)なら、現在HPに表示されている既定URLを編集前情報として出す(HPとの差異を防ぐ)
        document.getElementById('class-comp-entry-url-u16').value = data.entry_url || DEFAULT_COMP_ENTRY_URL;
        document.getElementById('class-comp-entry-enabled').checked = data.entry_enabled !== false;
        if (data.content) {
            try {
                const parsed = JSON.parse(data.content);
                if (Array.isArray(parsed) && parsed.length >= 1) {
                    const u16 = parsed[0];
                    document.getElementById('class-comp-content-u16').value = u16.content || '';
                    document.getElementById('class-comp-link-u16').value = u16.link || '';
                    if (u16.image) {
                        currentClassCompImageU16 = u16.image;
                        showImagePreview(document.getElementById('class-comp-image-preview-u16'), u16.image);
                    }
                }
            } catch (e) {
                console.error("Failed to parse CLASS_COMP json", e);
            }
        }
    }

    // CLASS_WORK は title/content/image/link をそのまま使う(フラットな形式)
    if (category === 'CLASS_WORK') {
        document.getElementById('class-work-entry-url').value = data.entry_url || DEFAULT_WORK_ENTRY_URL;
        document.getElementById('class-work-entry-enabled').checked = data.entry_enabled !== false;
        document.getElementById('class-work-content').value = data.content || '';
        document.getElementById('class-work-link').value = data.link || '';
        if (data.image) {
            currentClassWorkImage = data.image;
            showImagePreview(document.getElementById('class-work-image-preview'), data.image);
        }
    }

    // Stakeholders: stored as JSON in content field
    if (category === 'STAKEHOLDERS' && data.content) {
        let stakeholders = data.content;
        if (typeof stakeholders === 'string') {
            try { stakeholders = JSON.parse(stakeholders); } catch(e) { stakeholders = []; }
        }
        if (Array.isArray(stakeholders)) {
            stakeholders.forEach(s => addStakeholderCard(s.type, s));
        }
    }

    // TOOLS: stored as JSON in content field
    if (category === 'TOOLS' && data.content) {
        try {
            const tools = JSON.parse(data.content);
            if (Array.isArray(tools)) {
                tools.forEach(tool => addToolCard(tool));
            }
        } catch(e) {
            console.error("Failed to parse tools json", e);
        }
    }
}

let fixedFetchSeq = 0;

async function fetchFixedData() {
    // 取得中に別の項目へ切り替えられた場合、古い取得結果で新しい項目のフォームを上書きしないよう、最新の取得だけを反映する
    // (以前はこれが原因で、競技部門の内容がABOUTのフォームに入り、そのまま保存されてしまうことがあった)
    const requestId = ++fixedFetchSeq;
    const category = currentFixedCategory;

    updateFixedFormVisibility();
    const statusMsg = document.getElementById('fixed-status');
    statusMsg.className = 'status-msg';
    statusMsg.style.display = 'none';

    resetFixedForm();

    let data = null;
    try {
        const response = await fetch(`/api/fixed?category=${encodeURIComponent(category)}`);
        if (!response.ok) throw new Error('Failed to fetch fixed content');
        data = await response.json();
    } catch (error) {
        console.error(error);
        // --- Fallback for local demo ONLY ---
        try {
            const localFixed = JSON.parse(localStorage.getItem('mockFixedData') || '[]');
            data = localFixed.find(f => f.category === category) || null;
        } catch (e) {
            console.error("Local storage fixed content load failed", e);
        }
    }

    if (requestId !== fixedFetchSeq) return;
    if (data) populateFixedForm(category, data);
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

function addToolCard(data = {}) {
    const list = document.getElementById('tools-list');
    if (!list) return;

    const idx = list.children.length;
    const card = document.createElement('div');
    card.dataset.toolCard = idx;
    card.style.cssText = 'background: #ffffff; border: 2px solid var(--primary-light); border-radius: 12px; padding: 20px; position: relative; box-shadow: 0 2px 8px rgba(26,123,196,0.06);';

    card.innerHTML = `
        <button type="button" onclick="this.closest('[data-tool-card]').remove()" 
            style="position: absolute; top: 15px; right: 15px; background: rgba(214, 48, 49, 0.1); border: 1px solid rgba(214, 48, 49, 0.2); color: #d63031; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">削除</button>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 5px;">
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-dim); font-weight: 600;">ツール名 <span style="color: #ff8080;">*必須</span></label>
                <input type="text" class="tool-field-name" value="${data.name || ''}" placeholder="Scratch" required
                    style="width: 100%; padding: 10px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-family: inherit;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-dim); font-weight: 600;">URL (関連サイト・ダウンロードURL)</label>
                <input type="url" class="tool-field-url" value="${data.url || ''}" placeholder="https://scratch.mit.edu" 
                    style="width: 100%; padding: 10px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-family: inherit;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-size: 0.85rem; color: var(--text-dim); font-weight: 600;">詳細説明 (改行も反映されます)</label>
                <textarea class="tool-field-description" rows="3" placeholder="ビジュアルプログラミング言語。ドラッグ＆ドロップで簡単にプログラムを作ることができます。"
                    style="width: 100%; padding: 10px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: var(--text-main); font-family: inherit; resize: vertical;">${data.description || ''}</textarea>
            </div>
        </div>
    `;
    list.appendChild(card);
}

function getToolsFromForm() {
    const cards = document.querySelectorAll('#tools-list [data-tool-card]');
    const result = [];
    cards.forEach(card => {
        const name = card.querySelector('.tool-field-name').value.trim();
        const url = card.querySelector('.tool-field-url').value.trim();
        const description = card.querySelector('.tool-field-description').value.trim();
        if (name) {
            result.push({ name, url, description });
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

    // Logo field (企業アイコン)
    const logoDiv = document.createElement('div');
    const logoLabel = document.createElement('label');
    logoLabel.style.cssText = 'display: block; margin-bottom: 3px; font-size: 0.8rem; color: var(--text-dim);';
    logoLabel.innerHTML = '企業・団体ロゴ <span style="font-size: 0.75rem;">(任意・PDF/JPEG/PNG・5MBまで)</span>';
    logoDiv.appendChild(logoLabel);

    const logoHiddenInput = document.createElement('input');
    logoHiddenInput.type = 'hidden';
    logoHiddenInput.className = 'stakeholder-field-logo';
    logoHiddenInput.value = data.logo || '';
    logoDiv.appendChild(logoHiddenInput);

    const logoRow = document.createElement('div');
    logoRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const logoPreview = document.createElement('div');
    logoPreview.className = 'stakeholder-logo-preview';
    logoPreview.style.cssText = 'width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--primary-light); background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
    if (data.logo) {
        const previewImg = document.createElement('img');
        previewImg.src = data.logo;
        previewImg.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
        logoPreview.appendChild(previewImg);
    }
    logoRow.appendChild(logoPreview);

    const logoFileInput = document.createElement('input');
    logoFileInput.type = 'file';
    logoFileInput.accept = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';
    logoFileInput.style.cssText = 'flex: 1; font-size: 0.85rem;';
    bindImageUpload(logoFileInput, ([image]) => {
        logoHiddenInput.value = image;
        logoPreview.innerHTML = '';
        const previewImg = document.createElement('img');
        previewImg.src = image;
        previewImg.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
        logoPreview.appendChild(previewImg);
    });
    logoRow.appendChild(logoFileInput);

    logoDiv.appendChild(logoRow);
    wrapper.appendChild(logoDiv);

    // Logo size field (大=正方形 / 中=幅同じ・高さ半分)
    const sizeDiv = document.createElement('div');
    const sizeLabel = document.createElement('label');
    sizeLabel.style.cssText = 'display: block; margin-bottom: 3px; font-size: 0.8rem; color: var(--text-dim);';
    sizeLabel.innerHTML = 'ロゴ表示サイズ <span style="font-size: 0.75rem;">(協賛金額等に応じて選択)</span>';
    sizeDiv.appendChild(sizeLabel);
    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'stakeholder-field-size';
    sizeSelect.style.cssText = 'width: 100%; padding: 9px 12px; background: #ffffff; border: 1px solid var(--primary-light); border-radius: 8px; color: #000000; font-size: 0.95rem; font-family: inherit; cursor: pointer;';
    sizeSelect.innerHTML = `
        <option value="medium">中(標準:正方形の半分の高さ)</option>
        <option value="large">大(正方形で目立つ表示)</option>
    `;
    sizeSelect.value = data.size === 'large' ? 'large' : 'medium';
    sizeDiv.appendChild(sizeSelect);
    wrapper.appendChild(sizeDiv);

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
            const logo = card.querySelector('.stakeholder-field-logo').value.trim();
            const sizeEl = card.querySelector('.stakeholder-field-size');
            const size = sizeEl ? sizeEl.value : 'medium';
            if (name) result.push({ type, name, url, logo, size });
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
    let entry_url = null;
    let entry_enabled = true;

    if (category === 'STAKEHOLDERS') {
        const stakeholders = getStakeholdersFromForm();
        if (stakeholders.length === 0) {
            alert('\u5C11\u306A\u304F\u3068\u30821\u4EF6\u306E\u56E3\u4F53\u30FB\u4F1A\u793E\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002');
            return;
        }
        content = JSON.stringify(stakeholders);
    } else if (category === 'TOOLS') {
        const tools = getToolsFromForm();
        if (tools.length === 0) {
            alert('少なくとも1件のツールを登録してください。');
            return;
        }
        content = JSON.stringify(tools);
    } else if (category === 'CLASS_COMP') {
        const u16 = {
            content: document.getElementById('class-comp-content-u16').value.trim(),
            link: document.getElementById('class-comp-link-u16').value.trim(),
            image: currentClassCompImageU16
        };
        content = JSON.stringify([u16]);
        entry_url = document.getElementById('class-comp-entry-url-u16').value.trim() || null;
        entry_enabled = document.getElementById('class-comp-entry-enabled').checked;
    } else if (category === 'CLASS_WORK') {
        // 見出しは入力欄を出していないため、読み込んだ値(非表示のfixed-title)をそのまま保持する
        title = document.getElementById('fixed-title').value;
        content = document.getElementById('class-work-content').value;
        link = document.getElementById('class-work-link').value.trim();
        image = currentClassWorkImage;
        entry_url = document.getElementById('class-work-entry-url').value.trim() || null;
        entry_enabled = document.getElementById('class-work-entry-enabled').checked;
    } else {
        title = document.getElementById('fixed-title').value;
        content = document.getElementById('fixed-content').value;
    }

    const sns_data = getSnsAccountsFromForm();

    const payload = {
        category,
        title,
        content,
        link,
        entry_url,
        entry_enabled,
        image,
        sns_data
    };

    const body = JSON.stringify(payload);
    if (body.length > MAX_REQUEST_BODY_LENGTH) {
        alert('画像の合計サイズが大きすぎるため保存できません。小さい画像を選択してください。');
        return;
    }

    try {
        const response = await fetch('/api/fixed', {
            method: 'POST', // The backend upserts
            headers: { 'Content-Type': 'application/json' },
            body
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to save fixed content');
        }
        
        statusMsg.textContent = '\u5185\u5BB9\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F\u3002';
        statusMsg.className = 'status-msg success';
        statusMsg.style.display = 'block';

        // Also persist to localStorage for local fallback
        saveFixedContentToLocalStorage(category, payload);

        setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
        await fetchFixedData(); 
    } catch (error) {
        console.error(error);

        // --- Fallback for local demo ONLY (DBサーバーが無い/繋がらない環境向け) ---
        // API保存が失敗した場合でも、ブラウザ内(localStorage)には必ず保存する。
        // これが無いと入力内容がまるごと失われてしまう。
        saveFixedContentToLocalStorage(category, payload);

        let errorDetail = 'DBへの保存に失敗しましたが、ブラウザ内に一時保存しました。';
        if (error.message) errorDetail += ' (' + error.message + ')';
        statusMsg.textContent = errorDetail;
        statusMsg.className = 'status-msg error';
        statusMsg.style.display = 'block';

        await fetchFixedData();
    }
}

// fixed_content_table相当のデータをブラウザのlocalStorageにもUpsertしておく(API保存の成否に関わらず呼び出す)
function saveFixedContentToLocalStorage(category, payload) {
    try {
        let localFixed = JSON.parse(localStorage.getItem('mockFixedData') || '[]');
        const idx = localFixed.findIndex(f => f.category === category);
        const record = idx > -1 ? { ...localFixed[idx], ...payload } : { ...payload };
        if (idx > -1) localFixed[idx] = record;
        else localFixed.push(record);
        localStorage.setItem('mockFixedData', JSON.stringify(localFixed));
    } catch (e) {
        console.error('Failed to save fixed content to localStorage', e);
    }
}

// ======================
// 大会規約・プライバシーポリシー (PDF)
// ======================
let currentTermsPdfBase64 = null;
let currentPrivacyPdfBase64 = null;

const POLICY_CONFIG = {
    terms: { category: 'TERMS', title: '大会規約' },
    privacy: { category: 'PRIVACY_POLICY', title: 'プライバシーポリシー' }
};

function initPolicyLogic() {
    const termsInput = document.getElementById('terms-pdf-input');
    if (termsInput) {
        termsInput.addEventListener('change', (e) => handlePolicyPdfSelect(e, 'terms'));
    }
    const privacyInput = document.getElementById('privacy-pdf-input');
    if (privacyInput) {
        privacyInput.addEventListener('change', (e) => handlePolicyPdfSelect(e, 'privacy'));
    }

    ['terms', 'privacy'].forEach(kind => {
        const submitBtn = document.getElementById(kind + '-submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', () => runWithButtonLock(submitBtn, 'アップロード中...', () => submitPolicyPdf(kind)));

        const deleteBtn = document.getElementById(kind + '-delete-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => runWithButtonLock(deleteBtn, '削除中...', () => deletePolicyPdf(kind)));
    });
}

function setPolicyDeleteButtonVisible(kind, visible) {
    const btn = document.getElementById(kind + '-delete-btn');
    if (btn) btn.style.display = visible ? 'inline-block' : 'none';
}

function handlePolicyPdfSelect(e, kind) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        alert('PDFファイルを選択してください。');
        e.target.value = '';
        return;
    }
    if (file.size > 3 * 1024 * 1024) {
        // Base64化すると元ファイルの約1.33倍のサイズになり、サーバーレス関数のリクエストサイズ上限に
        // 引っかかりやすくなるため、元ファイルの上限は余裕を持って3MBまでにしておく
        alert('ファイルサイズは最大3MBまでです。');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        if (kind === 'terms') currentTermsPdfBase64 = ev.target.result;
        else currentPrivacyPdfBase64 = ev.target.result;

        const infoEl = document.getElementById(kind + '-current-info');
        if (infoEl) {
            infoEl.innerHTML = `<span style="color: var(--primary); font-weight: 600;">選択中のファイル: ${file.name}</span><br><span style="color: var(--text-dim); font-size: 0.8rem;">「アップロードして反映」を押すまで公開サイトには反映されません。</span>`;
        }
    };
    reader.readAsDataURL(file);
}

async function fetchPolicyPdf(kind) {
    const { category, title } = POLICY_CONFIG[kind];
    const infoEl = document.getElementById(kind + '-current-info');
    const inputEl = document.getElementById(kind + '-pdf-input');
    if (inputEl) inputEl.value = '';

    try {
        const res = await fetch(`/api/fixed?category=${category}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        if (data && data.content) {
            if (kind === 'terms') currentTermsPdfBase64 = data.content;
            else currentPrivacyPdfBase64 = data.content;

            if (infoEl) {
                infoEl.innerHTML = `<a href="${dataUrlToBlobUrl(data.content)}" target="_blank" rel="noopener" class="btn-outline" style="padding: 8px 16px; font-size: 0.85rem; display: inline-block;">現在のPDFを開く</a> <span style="color: var(--text-dim); font-size: 0.85rem; margin-left: 10px;">アップロード済み(${data.title || title}) ― HPのフッターに表示中</span>`;
            }
            setPolicyDeleteButtonVisible(kind, true);
        } else {
            showLocalPolicyPdfFallback(kind, category, title, infoEl);
        }
    } catch (e) {
        console.error(e);
        // --- Fallback for local demo ONLY (DBサーバーが無い/繋がらない環境向け) ---
        showLocalPolicyPdfFallback(kind, category, title, infoEl);
    }
}

// DB未接続時、ブラウザ内(localStorage の mockFixedData ― 公開サイト側(main.js)が読むのと同じキー)に
// 保存されたPDFがあればそれを表示する
function showLocalPolicyPdfFallback(kind, category, title, infoEl) {
    try {
        const localFixed = JSON.parse(localStorage.getItem('mockFixedData') || '[]');
        const localEntry = localFixed.find(f => f.category === category);
        if (localEntry && localEntry.content) {
            if (kind === 'terms') currentTermsPdfBase64 = localEntry.content;
            else currentPrivacyPdfBase64 = localEntry.content;
            if (infoEl) {
                infoEl.innerHTML = `<a href="${dataUrlToBlobUrl(localEntry.content)}" target="_blank" rel="noopener" class="btn-outline" style="padding: 8px 16px; font-size: 0.85rem; display: inline-block;">現在のPDFを開く</a> <span style="color: var(--text-dim); font-size: 0.85rem; margin-left: 10px;">ブラウザ内に一時保存済み(${localEntry.title || title})</span>`;
            }
            setPolicyDeleteButtonVisible(kind, true);
            return;
        }
    } catch (e) { /* ignore */ }

    if (kind === 'terms') currentTermsPdfBase64 = null;
    else currentPrivacyPdfBase64 = null;
    if (infoEl) {
        infoEl.innerHTML = `<span style="color: var(--text-dim);">まだアップロードされていません。未アップロードの間、公開サイトには「${title}」のリンク自体が表示されません。</span>`;
    }
    setPolicyDeleteButtonVisible(kind, false);
}

async function submitPolicyPdf(kind) {
    const { category, title } = POLICY_CONFIG[kind];
    const base64 = kind === 'terms' ? currentTermsPdfBase64 : currentPrivacyPdfBase64;
    const statusEl = document.getElementById(kind + '-status');
    if (statusEl) statusEl.style.display = ''; // 前回メッセージを自動で隠した際のdisplay:noneを解除

    const inputEl = document.getElementById(kind + '-pdf-input');
    if (!base64 || !(inputEl && inputEl.value)) {
        alert('アップロードするPDFファイルを選択してください。');
        return;
    }

    try {
        const res = await fetch('/api/fixed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, title, content: base64 })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || ('HTTP ' + res.status));
        }

        if (statusEl) {
            statusEl.textContent = '更新しました。公開サイトのリンク先に反映されます。';
            statusEl.className = 'status-msg success';
        }
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);
        await fetchPolicyPdf(kind);
    } catch (error) {
        console.error(error);

        // --- Fallback for local demo ONLY (DBサーバーが無い/繋がらない環境向け) ---
        // API保存が失敗した場合でも、ブラウザ内(mockFixedData ― 公開サイト側と共通のキー)には必ず保存する。
        saveFixedContentToLocalStorage(category, { category, title, content: base64 });

        if (statusEl) {
            statusEl.textContent = 'DBへの保存に失敗しましたが、ブラウザ内に一時保存しました。(' + (error.message || 'エラー') + ')';
            statusEl.className = 'status-msg error';
        }
        await fetchPolicyPdf(kind);
    }
}

// アップロード取り消し(削除)。削除するとHPのフッターからリンクが消える。
async function deletePolicyPdf(kind) {
    const { category, title } = POLICY_CONFIG[kind];
    if (!confirm(`「${title}」のPDFを削除しますか？
削除すると、公開サイトのフッターから「${title}」のリンクが非表示になります。`)) return;

    const statusEl = document.getElementById(kind + '-status');
    if (statusEl) statusEl.style.display = ''; // 前回メッセージを自動で隠した際のdisplay:noneを解除
    try {
        const res = await fetch('/api/fixed', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || ('HTTP ' + res.status));
        }
        if (statusEl) {
            statusEl.textContent = '削除しました。公開サイトのフッターからリンクが非表示になります。';
            statusEl.className = 'status-msg success';
        }
    } catch (error) {
        console.error(error);
        if (statusEl) {
            statusEl.textContent = 'DBからの削除に失敗しました。(' + (error.message || 'エラー') + ')';
            statusEl.className = 'status-msg error';
        }
    }

    // ブラウザ内の一時保存分(DB未接続時のフォールバック)も消しておく
    try {
        const localFixed = JSON.parse(localStorage.getItem('mockFixedData') || '[]');
        localStorage.setItem('mockFixedData', JSON.stringify(localFixed.filter(f => f.category !== category)));
    } catch (e) { /* ignore */ }

    if (kind === 'terms') currentTermsPdfBase64 = null;
    else currentPrivacyPdfBase64 = null;
    await fetchPolicyPdf(kind);
}
