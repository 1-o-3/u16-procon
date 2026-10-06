// 「今すぐエントリー」ボタン/QRコードの既定リンク。管理画面(admin.js)で entry_url が設定されるまではこの値を表示する。
// admin.js の DEFAULT_COMP_ENTRY_URL / DEFAULT_WORK_ENTRY_URL と必ず同じ値にすること(HPと管理画面の表示に差異が出ないようにするため)。
const DEFAULT_COMP_ENTRY_URL = 'https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/entry';
const DEFAULT_WORK_ENTRY_URL = 'https://blockly-chaser-shizuoka-do.blockly-chaser-shizuoka-do.workers.dev/works';

// 会場名で検索するGoogleマップのURL(管理画面でURL未設定のまま保存された記事用)。admin.js側にも同じ関数がある
function buildMapSearchUrl(location) {
    return location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '';
}

function buildQrUrl(targetUrl) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(targetUrl)}`;
}

// 「今すぐエントリー」ボタン＆QRコードの表示切り替え。
// 管理画面で非表示(entry_enabled = false)にされていれば隠す。レコード自体が無い場合は既定URLで表示する。
function applyEntryBlock(kind, defaultUrl, item) {
    const linkEl = document.getElementById(`hp-class-${kind}-entry-link`);
    if (!linkEl) return;
    const block = linkEl.closest('.entry-block');
    const enabled = !item || item.entry_enabled !== false;
    if (block) block.style.display = enabled ? '' : 'none';
    if (!enabled) return;

    const entryUrl = (item && item.entry_url) || defaultUrl;
    linkEl.href = entryUrl;
    const qrEl = document.getElementById(`hp-class-${kind}-entry-qr`);
    if (qrEl) qrEl.src = buildQrUrl(entryUrl);
}

// フッターの大会規約・プライバシーポリシーは、管理画面でPDFがアップロードされているものだけ表示する
function applyPolicyLinks(termsItem, privacyItem) {
    const entries = [
        ['footer-terms-link', termsItem],
        ['footer-privacy-link', privacyItem]
    ];
    let anyVisible = false;
    entries.forEach(([id, item]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const hasPdf = !!(item && item.content);
        if (hasPdf) el.href = dataUrlToBlobUrl(item.content);
        el.closest('li').style.display = hasPdf ? '' : 'none';
        if (hasPdf) anyVisible = true;
    });
    const section = document.getElementById('footer-links-section');
    if (section) section.style.display = anyVisible ? '' : 'none';
}

// data: URI(base64)のPDFを、直接href(=タブのURL)にすると数MBの巨大なURLになり、
// ブラウザのURL長制限に引っかかって白紙タブが開いてしまう(Chrome等では実測でも再現する既知の挙動)。
// blob: URLに変換すればURL自体は短く保たれ、内容はメモリ上のBlobとして渡されるため正しく表示される。
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
        return dataUrl; // 変換に失敗した場合は元のdata URLのままにする(最低限リンクは残す)
    }
}

// ==============================
// Top Navigation (共通上部タブメニュー)
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('topnav-toggle');
    const nav = document.getElementById('topnav-nav');
    const backdrop = document.getElementById('topnav-backdrop');

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            nav.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('active');
        });
    }
    if (backdrop && nav) {
        backdrop.addEventListener('click', () => {
            nav.classList.remove('open');
            backdrop.classList.remove('active');
        });
    }

    // Close the mobile menu after a nav link is tapped
    document.querySelectorAll('.topnav-nav a').forEach(a => {
        a.addEventListener('click', () => {
            if (nav) nav.classList.remove('open');
            if (backdrop) backdrop.classList.remove('active');
        });
    });

    // Highlight the current page's nav link.
    // Uses a "longest suffix match" so it works whether the site is opened via
    // the domain root ("/"), a clean URL ("/qa/"), a full path ("/qa/index.html"),
    // or even a local file:// path (double-clicking index.html) — all of which
    // should still resolve to HOME when nothing more specific matches.
    let currentPath = window.location.pathname.toLowerCase();
    if (currentPath.endsWith('/')) currentPath += 'index.html';

    let bestLink = null;
    let bestLen = -1;
    document.querySelectorAll('.topnav-nav ul a').forEach(a => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (href && currentPath.endsWith(href) && href.length > bestLen) {
            bestLink = a;
            bestLen = href.length;
        }
    });
    if (bestLink) bestLink.classList.add('active');
});

// ==============================
// 管理画面リンクの隠し表示
// フッター最下部(.footer-bottom)を5回タップ/クリックすると
// AdminMenuリンクが現れる。リロードすればまた非表示に戻る(状態は保存しない)。
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    const zones = document.querySelectorAll('.footer-bottom');
    if (zones.length === 0) return;

    let tapCount = 0;
    const reveal = () => {
        document.querySelectorAll('.admin-menu-link').forEach(a => a.classList.add('revealed'));
    };

    zones.forEach(zone => {
        zone.addEventListener('click', () => {
            tapCount++;
            if (tapCount >= 5) reveal();
        });
    });
});

// ==============================
// 開催情報ページ内のタブ切り替え（今期／過去）
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.schedule-tab');
    if (tabs.length === 0) return;
    const panes = document.querySelectorAll('.schedule-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.target);
            if (target) target.classList.add('active');
        });
    });
});

// Intersection Observer for scroll reveals
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.glass, .section-title, .timeline-item').forEach(el => {
    el.classList.add('reveal-on-scroll');
    observer.observe(el);
});

// Add extra CSS for scroll reveal
const style = document.createElement('style');
style.textContent = `
    .reveal-on-scroll {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.8s ease;
    }
    .reveal-on-scroll.reveal {
        opacity: 1;
        transform: translateY(0);
    }
`;
document.head.appendChild(style);

// ==============================
// お知らせ（ホーム）
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('home-news-container');
    if (!container) return;

    try {
        let newsData = [];
        try {
            const response = await fetch('/api/news');
            if (response.ok) {
                newsData = await response.json();
            } else {
                throw new Error('API fetch failed');
            }
        } catch (e) {
            console.log("Using local mock data for news");
            const local = localStorage.getItem('mockNewsData');
            if (local) {
                newsData = JSON.parse(local);
            }
        }

        // お知らせカテゴリのみをホームに表示（開催情報は「開催情報」ページで確認）
        const activeNews = newsData.filter(n => n.category === 'お知らせ');

        if (activeNews.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-dim); padding: 20px;" class="glass">現在お知らせはありません。</p>';
            return;
        }

        container.innerHTML = '';
        // Show up to 5 recent news
        activeNews.slice(0, 5).forEach(item => {
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('ja-JP') : new Date().toLocaleDateString('ja-JP');
            const hasSubinfo = item.start_date || item.location || item.target_age;

            const div = document.createElement('div');
            div.className = 'glass reveal-on-scroll';
            div.style.padding = '20px';
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '10px';
            div.style.borderLeft = '4px solid var(--primary)';

            let html = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; flex-wrap: wrap;">
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <span style="background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; color: var(--primary); font-weight: 600;">${item.category}</span>
                        <span style="color: var(--text-dim); font-size: 0.9rem;">${dateStr}</span>
                    </div>
                </div>
                <h3 style="font-size: 1.2rem; color: var(--text-main); font-weight: 700;">${item.title}</h3>
                <p style="color: var(--text-dim); font-size: 0.95rem; white-space: pre-wrap;">${item.content}</p>
            `;

            if (hasSubinfo) {
                html += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--primary-light); display: flex; flex-direction: column; gap: 5px; font-size: 0.9rem;">`;
                if (item.start_date) {
                    html += `<div><strong style="color: var(--secondary);">開催日:</strong> ${new Date(item.start_date).toLocaleDateString('ja-JP')} ${item.start_time || ''} ${item.end_time ? '〜 ' + item.end_time : ''} ${item.is_tentative ? '(予定)' : ''}</div>`;
                }
                if (item.location) {
                    html += `<div><strong style="color: var(--secondary);">場所:</strong> <a href="${item.map_url || buildMapSearchUrl(item.location)}" target="_blank" rel="noopener" style="color: var(--primary);">${item.location}</a></div>`;
                }
                if (item.target_age) {
                    html += `<div><strong style="color: var(--secondary);">対象:</strong> ${item.target_age}</div>`;
                }
                if (item.application_url) {
                    html += `<div style="margin-top: 10px;"><a href="${item.application_url}" target="_blank" class="btn-primary" style="padding: 8px 15px; font-size: 0.85rem; display: inline-block;">申し込みはこちら</a></div>`;
                }
                html += `</div>`;
            }

            if (item.images && item.images.length > 0) {
                 html += `<div style="display: flex; gap: 10px; margin-top: 10px; overflow-x: auto; padding-bottom: 5px;">
                     ${item.images.map(src => `<img src="${src}" style="height: 120px; border-radius: 8px; object-fit: cover;">`).join('')}
                 </div>`;
            }

            div.innerHTML = html;
            container.appendChild(div);
            observer.observe(div); // Apply scroll reveal to new elements
        });
        renderPdfImages(container);

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px;" class="glass">お知らせの読み込みに失敗しました。</p>';
    }
});

// ==============================
// 固定コンテンツ（ABOUT / 部門紹介 / ツール紹介 / SNS / スポンサー）
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        let fixedData = [];
        try {
            const response = await fetch('/api/fixed', { cache: 'no-store' });
            if (response.ok) {
                fixedData = await response.json();
            } else {
                throw new Error();
            }
        } catch (e) {
            console.log("Using local mock data for fixed content");
            const local = localStorage.getItem('mockFixedData');
            if (local) {
                fixedData = JSON.parse(local);
            }
        }

        fixedData.forEach(item => {
            if (item.category === 'ABOUT' && item.content) {
                const aboutEl = document.getElementById('hp-about-content');
                if (aboutEl) aboutEl.innerHTML = item.content;
            } else if (item.category === 'CLASS_COMP') {
                // 競技部門は U-16部門のみを掲載（O-16部門は非掲載）
                const contentEl = document.getElementById('hp-class-comp-content');
                const imgContainer = document.getElementById('hp-class-comp-img-container');
                const moreLinkEl = document.getElementById('hp-class-comp-more-link');

                if (contentEl && item.content) {
                    let u16 = null;
                    try {
                        const parsed = JSON.parse(item.content);
                        if (Array.isArray(parsed)) u16 = parsed[0];
                    } catch (e) {
                        u16 = null;
                    }

                    if (u16) {
                        if (u16.content) contentEl.innerHTML = `<p style="white-space: pre-wrap;">${u16.content}</p>`;
                        if (imgContainer && u16.image) {
                            imgContainer.innerHTML = `<img src="${u16.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
                            imgContainer.style.border = 'none';
                        }
                        if (moreLinkEl && u16.link) {
                            moreLinkEl.innerHTML = `<a href="${u16.link}" target="_blank" rel="noopener" class="btn-outline" style="padding: 8px 15px; font-size: 0.85rem;">もっと詳しく</a>`;
                        }
                    } else {
                        // 旧フォーマット（フラットな title/content/image/link）へのフォールバック
                        contentEl.innerHTML = `<p style="white-space: pre-wrap;">${item.content}</p>`;
                        if (imgContainer && item.image) {
                            imgContainer.innerHTML = `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
                            imgContainer.style.border = 'none';
                        }
                        if (moreLinkEl && item.link) {
                            moreLinkEl.innerHTML = `<a href="${item.link}" target="_blank" rel="noopener" class="btn-outline" style="padding: 8px 15px; font-size: 0.85rem;">もっと詳しく</a>`;
                        }
                    }
                }
            } else if (item.category === 'CLASS_WORK') {
                const titleEl = document.getElementById('hp-class-work-title');
                const contentEl = document.getElementById('hp-class-work-content');
                const imgContainer = document.getElementById('hp-class-work-img-container');

                if (titleEl && item.title) titleEl.textContent = item.title;
                if (contentEl && item.content) {
                    contentEl.innerHTML = item.content;
                    if (item.link) {
                        contentEl.innerHTML += `<div style="margin-top: 15px;"><a href="${item.link}" target="_blank" class="btn-outline" style="padding: 8px 15px; font-size: 0.85rem;">もっと詳しく</a></div>`;
                    }
                }
                if (imgContainer && item.image) {
                    imgContainer.innerHTML = `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
                    imgContainer.style.border = 'none';
                }
            } else if (item.category === 'SNS') {
                // 登録されているSNSアカウントが1件以上あれば表示、無ければセクションごと非表示にする(自動切り替え)
                const snsContainer = document.getElementById('hp-sns-container');
                const snsSection = document.getElementById('sns-section');
                if (snsContainer) {
                    let snsData = item.sns_data;
                    if (typeof snsData === 'string') {
                        try { snsData = JSON.parse(snsData); } catch (e) { snsData = null; }
                    }

                    let accounts = [];
                    if (Array.isArray(snsData)) {
                        accounts = snsData;
                    } else if (snsData) {
                        if (snsData.x && (snsData.x.id || snsData.x.link)) {
                            accounts.push({ service: 'X (旧Twitter)', id: snsData.x.id || '', link: snsData.x.link || '', comment: '' });
                        }
                        if (snsData.insta && (snsData.insta.id || snsData.insta.link)) {
                            accounts.push({ service: 'Instagram', id: snsData.insta.id || '', link: snsData.insta.link || '', comment: '' });
                        }
                        if (snsData.youtube && (snsData.youtube.id || snsData.youtube.link)) {
                            accounts.push({ service: 'YouTube', id: snsData.youtube.id || '', link: snsData.youtube.link || '', comment: '' });
                        }
                    }
                    // サービス名・IDのどちらも入っていない空カードは登録数に数えない
                    accounts = accounts.filter(acc => (acc.service && acc.service.trim()) || (acc.id && acc.id.trim()) || (acc.link && acc.link.trim()));

                    if (accounts.length > 0) {
                        let html = `<div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">`;
                        accounts.forEach(acc => {
                            const displayId = acc.id ? acc.id : '';
                            const label = `${acc.service}${displayId ? '　' + displayId : ''}`;
                            const linkHtml = acc.link
                                ? `<a href="${acc.link}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: none; font-weight: 700; font-size: 1.05rem;">${label}</a>`
                                : `<span style="color: var(--text-main); font-weight: 700; font-size: 1.05rem;">${label}</span>`;
                            html += `
                                <div class="glass" style="padding: 20px 25px; min-width: 200px; text-align: center; display: flex; flex-direction: column; gap: 8px;">
                                    <div style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;">${acc.service}</div>
                                    ${linkHtml}
                                    ${acc.comment ? `<div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 4px;">${acc.comment}</div>` : ''}
                                </div>`;
                        });
                        html += `</div>`;
                        snsContainer.innerHTML = html;
                        if (snsSection) snsSection.style.display = 'block';
                    } else {
                        snsContainer.innerHTML = '';
                        if (snsSection) snsSection.style.display = 'none';
                    }
                }
            } else if (item.category === 'STAKEHOLDERS' && item.content) {
                // スポンサーページ専用のコンテナがある場合のみ描画
                const sponsorContainer = document.getElementById('sponsor-list-container');
                if (sponsorContainer) {
                    let stakeholders = item.content;
                    if (typeof stakeholders === 'string') {
                        try { stakeholders = JSON.parse(stakeholders); } catch (e) { stakeholders = []; }
                    }

                    if (Array.isArray(stakeholders) && stakeholders.length > 0) {
                        const order = ['主催', '共催', '協賛', '後援', '協力'];
                        const groups = {};
                        stakeholders.forEach(s => {
                            if (!groups[s.type]) groups[s.type] = [];
                            groups[s.type].push(s);
                        });

                        const renderCard = (type, s) => {
                            // URLが登録されている名称は薄い色の下線で示す
                            const nameHtml = `<span class="sponsor-name${s.url ? ' has-link' : ''}">${s.name}</span>`;
                            // 主催・共催・後援・協力はロゴを出さず名称のみ。URLがあればカード全体をリンクにする
                            if (type !== '協賛') {
                                return s.url
                                    ? `<a href="${s.url}" target="_blank" rel="noopener" class="sponsor-card sponsor-card-name-only glass">${nameHtml}</a>`
                                    : `<div class="sponsor-card sponsor-card-name-only glass">${nameHtml}</div>`;
                            }
                            // ロゴサイズ:「大」(size:large)は正方形枠、「中」(既定値)は幅同じ・高さ半分の枠
                            const sizeClass = s.size === 'large' ? '' : 'size-medium';
                            const logoHtml = s.logo
                                ? `<div class="sponsor-logo-frame ${sizeClass}"><img src="${s.logo}" alt="${s.name}"></div>`
                                : `<div class="sponsor-logo-frame ${sizeClass} sponsor-logo-placeholder">${(s.name || '?').charAt(0)}</div>`;
                            // 協賛は企業名のみをリンクにする
                            const sponsorNameHtml = s.url
                                ? `<a href="${s.url}" target="_blank" rel="noopener">${nameHtml}</a>`
                                : nameHtml;
                            // ロゴエリアの高さをロゴサイズに合わせる(同じサイズ同士で並べるので企業名の位置はそろう)
                            return `<div class="sponsor-card glass"><div class="sponsor-logo-area ${sizeClass}">${logoHtml}</div>${sponsorNameHtml}</div>`;
                        };

                        const renderGrid = (type, list, extraClass = '') =>
                            `<div class="sponsor-grid${extraClass}">${list.map(s => renderCard(type, s)).join('')}</div>`;

                        let html = '';
                        order.forEach(type => {
                            if (!groups[type] || groups[type].length === 0) return;
                            let gridsHtml;
                            // 協賛はロゴサイズでカードの大きさが変わるため、登録順に関わらず「大」→「中」の順に段を分けて並べる
                            if (type === '協賛') {
                                const large = groups[type].filter(s => s.size === 'large');
                                const medium = groups[type].filter(s => s.size !== 'large');
                                gridsHtml = (large.length ? renderGrid(type, large) : '')
                                    + (medium.length ? renderGrid(type, medium, ' sponsor-grid-medium') : '');
                            } else {
                                gridsHtml = renderGrid(type, groups[type], type === '主催' ? ' sponsor-grid-organizer' : '');
                            }
                            html += `<div class="sponsor-group reveal-on-scroll">
                                <h3 class="sponsor-group-title">${type}</h3>
                                ${gridsHtml}
                            </div>`;
                        });

                        sponsorContainer.innerHTML = html;
                        document.querySelectorAll('#sponsor-list-container .reveal-on-scroll').forEach(el => observer.observe(el));
                    } else {
                        sponsorContainer.innerHTML = '<p style="text-align: center; color: var(--text-dim); padding: 20px;" class="glass">スポンサー情報は準備中です。</p>';
                    }
                }
            } else if (item.category === 'TOOLS' && item.content) {
                const toolsContainer = document.getElementById('hp-tools-container');
                if (toolsContainer) {
                    try {
                        const tools = JSON.parse(item.content);
                        if (Array.isArray(tools) && tools.length > 0) {
                            let html = '';
                            tools.forEach(tool => {
                                const titleHtml = tool.url
                                    ? `<h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 10px;"><a href="${tool.url}" target="_blank" style="color: var(--primary); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--secondary)'" onmouseout="this.style.color='var(--primary)'">${tool.name} 🔗</a></h3>`
                                    : `<h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-bottom: 10px;">${tool.name}</h3>`;

                                html += `
                                    <div class="glass reveal-on-scroll" style="padding: 25px; border-radius: 16px; border: 1px solid var(--glass-border); text-align: left; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 30px rgba(26, 123, 196, 0.1)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                                        ${titleHtml}
                                        <p style="color: var(--text-dim); font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; margin: 0; flex-grow: 1;">${tool.description}</p>
                                    </div>
                                `;
                            });
                            toolsContainer.innerHTML = html;
                            document.querySelectorAll('#hp-tools-container .reveal-on-scroll').forEach(el => {
                                observer.observe(el);
                            });
                        } else {
                            toolsContainer.innerHTML = '<p style="text-align: center; color: var(--text-dim); padding: 20px; grid-column: 1/-1;" class="glass">現在紹介されているツールはありません。</p>';
                        }
                    } catch (e) {
                        console.error("Failed to parse tools json", e);
                        toolsContainer.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px; grid-column: 1/-1;" class="glass">ツール情報の解析に失敗しました。</p>';
                    }
                }
            }
        });

        const byCategory = {};
        fixedData.forEach(item => { byCategory[item.category] = item; });
        applyEntryBlock('comp', DEFAULT_COMP_ENTRY_URL, byCategory['CLASS_COMP']);
        applyEntryBlock('work', DEFAULT_WORK_ENTRY_URL, byCategory['CLASS_WORK']);
        applyPolicyLinks(byCategory['TERMS'], byCategory['PRIVACY_POLICY']);
        renderPdfImages();

    } catch (e) {
        console.error("Failed to load fixed content", e);
        applyEntryBlock('comp', DEFAULT_COMP_ENTRY_URL, null);
        applyEntryBlock('work', DEFAULT_WORK_ENTRY_URL, null);
    }
});

// ==============================
// 「今期の開催情報」セクション
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('home-current-container');
    if (!container) return;

    try {
        let data = [];
        try {
            const response = await fetch('/api/news?category=' + encodeURIComponent('今期の開催情報'));
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('API fetch failed');
            }
        } catch (e) {
            console.log("Using local mock data for current events");
            const local = localStorage.getItem('mockNewsData');
            if (local) {
                const allNews = JSON.parse(local);
                data = allNews.filter(n => n.category === '今期の開催情報' && !n.is_past);
            }
        }

        if (data.length === 0) {
            container.innerHTML = `
                <div class="glass" style="text-align: center; padding: 40px;">
                    <h3 style="color: var(--text-main); margin-bottom: 10px;">2026年度 大会概要</h3>
                    <p style="color: var(--text-dim);">現在開催準備を進めております。詳細が決まり次第お知らせします。</p>
                </div>`;
            return;
        }

        container.innerHTML = '';
        // 今期の開催情報は1件のみ掲載する(APIは新しい順なので先頭が最新。以前の重複投稿が残っていても表示しない)
        data.slice(0, 1).forEach(item => {
            // 1大会ごとに「ポスター(枠なし)」と「詳細情報のカード」を別々に縦に並べる
            const eventEl = document.createElement('div');
            eventEl.className = 'reveal-on-scroll';
            eventEl.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

            if (item.poster_image) {
                const poster = document.createElement('img');
                poster.src = item.poster_image;
                poster.alt = `${item.title} ポスター`;
                poster.style.cssText = 'width: 100%; max-width: 560px; display: block; margin: 0 auto;';
                eventEl.appendChild(poster);
            }

            const div = document.createElement('div');
            div.className = 'glass';
            div.style.padding = '25px';

            let html = '';

            // Title
            html += `<h3 style="font-size: 1.3rem; color: var(--text-main); font-weight: 700; margin-bottom: 12px;">${item.title}</h3>`;

            // Event details grid
            let detailsHtml = '';
            if (item.start_date) {
                const dateStr = new Date(item.start_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
                const timeStr = item.start_time ? ` ${item.start_time}` : '';
                const endStr = item.end_time ? ` 〜 ${item.end_time}` : '';
                const tentStr = item.is_tentative ? ' <span style="background: var(--secondary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 5px;">予定</span>' : '';
                detailsHtml += `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: var(--primary); font-weight: 700; min-width: 70px;">📅 日時</span><span style="color: var(--text-main);">${dateStr}${timeStr}${endStr}${tentStr}</span></div>`;
            }
            if (item.location) {
                const locHtml = `<a href="${item.map_url || buildMapSearchUrl(item.location)}" target="_blank" rel="noopener" style="color: var(--primary); text-decoration: underline;">${item.location}</a>`;
                detailsHtml += `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: var(--primary); font-weight: 700; min-width: 70px;">📍 会場</span><span style="color: var(--text-main);">${locHtml}</span></div>`;
            }
            if (item.target_age) {
                detailsHtml += `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: var(--primary); font-weight: 700; min-width: 70px;">👤 対象</span><span style="color: var(--text-main);">${item.target_age}</span></div>`;
            }
            if (item.divisions && item.divisions.length > 0) {
                let divList = typeof item.divisions === 'string' ? JSON.parse(item.divisions) : item.divisions;
                if (divList && divList.length > 0) {
                    const hasSubdivision = divList.some(d => d.includes('競技部門 ('));
                    if (hasSubdivision) {
                        divList = divList.filter(d => d !== '競技部門');
                    }
                }
                detailsHtml += `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: var(--primary); font-weight: 700; min-width: 70px;">🏆 部門</span><span style="color: var(--text-main);">${divList.join('・')}</span></div>`;
            }

            if (detailsHtml) {
                html += `<div style="display: flex; flex-direction: column; gap: 8px; padding: 15px; background: var(--primary-pale); border-radius: 10px; margin-bottom: 15px;">${detailsHtml}</div>`;
            }

            // Content
            if (item.content) {
                html += `<p style="color: var(--text-dim); font-size: 0.95rem; white-space: pre-wrap; line-height: 1.7;">${item.content}</p>`;
            }

            // Images
            if (item.images && item.images.length > 0) {
                const imgs = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
                html += `<div style="display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; padding-bottom: 5px;">
                    ${imgs.map(src => `<img src="${src}" style="height: 150px; border-radius: 10px; object-fit: cover;">`).join('')}
                </div>`;
            }

            // Action buttons
            let btnsHtml = '';
            if (item.application_url) {
                btnsHtml += `<a href="${item.application_url}" target="_blank" class="btn-glow" style="padding: 10px 20px; font-size: 0.9rem;">申し込みはこちら</a>`;
            }
            if (item.overview_url) {
                btnsHtml += `<a href="${item.overview_url}" target="_blank" class="btn-outline" style="padding: 10px 20px; font-size: 0.9rem;">詳細を見る</a>`;
            }
            if (btnsHtml) {
                html += `<div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">${btnsHtml}</div>`;
            }

            div.innerHTML = html;
            eventEl.appendChild(div);
            container.appendChild(eventEl);
            observer.observe(eventEl);
        });
        renderPdfImages(container);

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px;" class="glass">開催情報の読み込みに失敗しました。</p>';
    }
});

// ==============================
// 「過去の開催情報」セクション
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('home-past-container');
    if (!container) return;

    try {
        let data = [];
        try {
            const response = await fetch('/api/news?category=' + encodeURIComponent('過去の開催情報'));
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('API fetch failed');
            }
        } catch (e) {
            console.log("Using local mock data for past events");
            const local = localStorage.getItem('mockNewsData');
            if (local) {
                const allNews = JSON.parse(local);
                data = allNews.filter(n => n.category === '過去の開催情報' || (n.category === '今期の開催情報' && n.is_past));
            }
        }

        if (data.length === 0) {
            container.innerHTML = `
                <div class="glass" style="text-align: center; padding: 40px;">
                    <p style="color: var(--text-dim);">過去の開催情報はまだありません。</p>
                </div>`;
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'glass reveal-on-scroll';
            div.style.padding = '25px';

            let html = '';

            // Title and date
            html += `<h3 style="font-size: 1.2rem; color: var(--text-main); font-weight: 700; margin-bottom: 8px;">${item.title}</h3>`;
            if (item.start_date) {
                const dateStr = new Date(item.start_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
                html += `<p style="color: var(--primary); font-size: 0.9rem; margin-bottom: 12px;">📅 ${dateStr}</p>`;
            }

            // Content
            if (item.content) {
                html += `<p style="color: var(--text-dim); font-size: 0.95rem; white-space: pre-wrap; line-height: 1.7;">${item.content}</p>`;
            }

            // Event info
            let infoHtml = '';
            if (item.location) {
                infoHtml += `<span style="color: var(--text-dim); font-size: 0.85rem;">📍 ${item.location}</span>`;
            }
            if (item.participants) {
                infoHtml += `<span style="color: var(--text-dim); font-size: 0.85rem;">👥 参加者: ${item.participants}名</span>`;
            }
            if (infoHtml) {
                html += `<div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px;">${infoHtml}</div>`;
            }

            // Past images (gallery)
            const pastImgs = item.past_images ? (typeof item.past_images === 'string' ? JSON.parse(item.past_images) : item.past_images) : [];
            const mainImgs = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
            const allImgs = [...pastImgs, ...mainImgs];
            if (allImgs.length > 0) {
                html += `<div style="display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; padding-bottom: 5px;">
                    ${allImgs.map(src => `<img src="${src}" style="height: 140px; border-radius: 10px; object-fit: cover;">`).join('')}
                </div>`;
            }

            // Participant comments
            if (item.participant_comments) {
                const comments = typeof item.participant_comments === 'string' ? JSON.parse(item.participant_comments) : item.participant_comments;
                if (comments && comments.length > 0) {
                    html += `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--primary-light);">
                        <p style="color: var(--primary); font-size: 0.85rem; font-weight: 700; margin-bottom: 8px;">💬 参加者の声</p>
                        ${comments.map(c => `<div style="background: var(--primary-pale); border-radius: 8px; padding: 10px 15px; margin-bottom: 6px; color: var(--text-dim); font-size: 0.9rem; font-style: italic;">「${c}」</div>`).join('')}
                    </div>`;
                }
            }

            div.innerHTML = html;
            container.appendChild(div);
            observer.observe(div);
        });
        renderPdfImages(container);

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px;" class="glass">過去の開催情報の読み込みに失敗しました。</p>';
    }
});
