// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.style.padding = '15px 0';
        header.style.background = 'rgba(240, 246, 255, 0.97)';
        header.style.boxShadow = '0 2px 20px rgba(26, 123, 196, 0.12)';
    } else {
        header.style.padding = '20px 0';
        header.style.background = 'rgba(240, 246, 255, 0.88)';
        header.style.boxShadow = '0 2px 16px rgba(26, 123, 196, 0.08)';
    }
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

// Fetch News Data
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

        // Filter and display top news
        const activeNews = newsData.filter(n => n.category === 'お知らせ' || n.category === '今期の開催情報');
        
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
                    html += `<div><strong style="color: var(--secondary);">場所:</strong> ${item.map_url ? `<a href="${item.map_url}" target="_blank" style="color: var(--primary);">${item.location}</a>` : item.location}</div>`;
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

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px;" class="glass">お知らせの読み込みに失敗しました。</p>';
    }
});

// Fetch Fixed Data (ABOUT, CLASS, SNS)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        let fixedData = [];
        try {
            const response = await fetch('/api/fixed');
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
                const compCard = document.getElementById('hp-class-comp');
                if (compCard && item.content) {
                    try {
                        const parsed = JSON.parse(item.content);
                        if (Array.isArray(parsed) && parsed.length >= 2) {
                            const u16 = parsed[0];
                            const o16 = parsed[1];

                            const imgHtmlU16 = u16.image ? `<img src="${u16.image}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 10px; margin-top: 10px;">` : '';
                            const linkHtmlU16 = u16.link ? `<div style="margin-top: 12px;"><a href="${u16.link}" target="_blank" class="btn-outline" style="padding: 6px 14px; font-size: 0.8rem; border-width: 1.5px; display: inline-block;">もっと詳しく</a></div>` : '';

                            const imgHtmlO16 = o16.image ? `<img src="${o16.image}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 10px; margin-top: 10px;">` : '';
                            const linkHtmlO16 = o16.link ? `<div style="margin-top: 12px;"><a href="${o16.link}" target="_blank" class="btn-outline" style="padding: 6px 14px; font-size: 0.8rem; border-width: 1.5px; display: inline-block;">もっと詳しく</a></div>` : '';

                            compCard.innerHTML = `
                                <div class="icon">競技</div>
                                <h3 style="font-size: 1.5rem; color: var(--text-main); font-weight: 800; margin-bottom: 20px;">競技部門</h3>
                                <div style="display: flex; flex-direction: column; gap: 20px;">
                                    <div style="background: var(--primary-pale); padding: 20px; border-radius: 16px; border: 1px solid var(--glass-border); text-align: left;">
                                        <h4 style="color: var(--primary); font-weight: 800; margin-bottom: 8px; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">👦 ${u16.title}</h4>
                                        <div style="color: var(--text-main); font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap;">${u16.content}</div>
                                        ${imgHtmlU16}
                                        ${linkHtmlU16}
                                    </div>
                                    <div style="background: var(--secondary-pale); padding: 20px; border-radius: 16px; border: 1px solid var(--glass-border); text-align: left;">
                                        <h4 style="color: var(--secondary); font-weight: 800; margin-bottom: 8px; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">🧑 ${o16.title}</h4>
                                        <div style="color: var(--text-main); font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap;">${o16.content}</div>
                                        ${imgHtmlO16}
                                        ${linkHtmlO16}
                                    </div>
                                </div>
                            `;
                        } else {
                            renderLegacyClassComp(compCard, item);
                        }
                    } catch (e) {
                        renderLegacyClassComp(compCard, item);
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
            } else if (item.category === 'SNS' && item.sns_data) {
                const snsContainer = document.getElementById('hp-sns-container');
                if (snsContainer) {
                    let snsData = item.sns_data;
                    if (typeof snsData === 'string') snsData = JSON.parse(snsData);

                    // Support both new array format and legacy object format
                    let accounts = [];
                    if (Array.isArray(snsData)) {
                        accounts = snsData;
                    } else {
                        // Legacy format fallback
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

                    if (accounts.length > 0) {
                        let html = `<div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">`;
                        accounts.forEach(acc => {
                            const displayId = acc.id ? acc.id : '';
                            const label = `${acc.service}${displayId ? '　' + displayId : ''}`;
                            const linkHtml = acc.link
                                ? `<a href="${acc.link}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: none; font-weight: 700; font-size: 1.05rem;">${label}</a>`
                                : `<span style="color: white; font-weight: 700; font-size: 1.05rem;">${label}</span>`;
                            html += `
                                <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 12px; padding: 20px 25px; min-width: 200px; text-align: center; display: flex; flex-direction: column; gap: 8px; transition: background 0.2s;" 
                                     onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
                                     onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <div style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;">${acc.service}</div>
                                    ${linkHtml}
                                    ${acc.comment ? `<div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 4px;">${acc.comment}</div>` : ''}
                                </div>`;
                        });
                        html += `</div>`;
                        snsContainer.innerHTML = html;
                    }
                }
            } else if (item.category === 'STAKEHOLDERS' && item.content) {
                let stakeholders = item.content;
                if (typeof stakeholders === 'string') {
                    try { stakeholders = JSON.parse(stakeholders); } catch(e) { stakeholders = []; }
                }
                if (Array.isArray(stakeholders) && stakeholders.length > 0) {
                    const groups = {};
                    stakeholders.forEach(s => {
                        if (!groups[s.type]) groups[s.type] = [];
                        groups[s.type].push(s);
                    });

                    const hostEl = document.getElementById('hp-stakeholder-host');
                    const coEl = document.getElementById('hp-stakeholder-co');

                    if (hostEl && groups['主催']) {
                        hostEl.innerHTML = '<span style="color: rgba(255,255,255,0.5); font-size: 0.85rem; font-weight: 600;">主催</span><br>' +
                            groups['主催'].map(s => s.url
                                ? '<a href="' + s.url + '" target="_blank" rel="noopener" style="color: rgba(255,255,255,0.75); font-size: 0.9rem; text-decoration: none; display: inline-block; margin-top: 2px;">' + s.name + '</a>'
                                : '<span style="color: rgba(255,255,255,0.75); font-size: 0.9rem;">' + s.name + '</span>'
                            ).join('<br>');
                    }
                    if (coEl) {
                        let coHtml = '';
                        ['共催', '協賛', '後援'].forEach(type => {
                            if (groups[type]) {
                                coHtml += '<span style="color: rgba(255,255,255,0.5); font-size: 0.85rem; font-weight: 600; display: block; margin-top: 8px;">' + type + '</span>';
                                coHtml += groups[type].map(s => s.url
                                    ? '<a href="' + s.url + '" target="_blank" rel="noopener" style="color: rgba(255,255,255,0.75); font-size: 0.9rem; text-decoration: none; display: inline-block; margin-top: 2px;">' + s.name + '</a>'
                                    : '<span style="color: rgba(255,255,255,0.75); font-size: 0.9rem;">' + s.name + '</span>'
                                ).join('<br>');
                            }
                        });
                        if (coHtml) coEl.innerHTML = coHtml;
                    }
                }
            }
        });

    } catch (e) {
        console.error("Failed to load fixed content", e);
    }
});

// ==============================
// Fetch "今期の開催情報" Section
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
                    <div style="margin-top: 20px;">
                        <a href="https://forms.gle/9AU6rz7fzH7mLzQM7" target="_blank" class="btn-glow">参加申し込みフォームはこちら</a>
                    </div>
                </div>`;
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'glass reveal-on-scroll';
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
                const locHtml = item.map_url
                    ? `<a href="${item.map_url}" target="_blank" style="color: var(--primary); text-decoration: underline;">${item.location}</a>`
                    : item.location;
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
            container.appendChild(div);
            observer.observe(div);
        });

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px;" class="glass">開催情報の読み込みに失敗しました。</p>';
    }
});

// ==============================
// Fetch "過去の開催情報" Section
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
                    <p style="color: var(--text-dim);">過去の大会データは現在整理中です。</p>
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

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px;" class="glass">過去の開催情報の読み込みに失敗しました。</p>';
    }
});

// ==============================
// Fetch "他所での開催" Section
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('home-other-container');
    if (!container) return;

    try {
        let data = [];
        try {
            const response = await fetch('/api/news?category=' + encodeURIComponent('他所での開催'));
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('API fetch failed');
            }
        } catch (e) {
            console.log("Using local mock data for other events");
            const local = localStorage.getItem('mockNewsData');
            if (local) {
                const allNews = JSON.parse(local);
                data = allNews.filter(n => n.category === '他所での開催');
            }
        }

        if (data.length === 0) {
            container.innerHTML = `
                <div class="glass" style="text-align: center; padding: 40px;">
                    <p style="color: var(--text-dim);">U-16プログラミングコンテストは全国各地で開催されています。<br>各地域の情報は随時更新されます。</p>
                </div>`;
            return;
        }

        container.innerHTML = '';

        // Intro text
        const intro = document.createElement('p');
        intro.style.cssText = 'color: var(--text-dim); text-align: center; margin-bottom: 10px; font-size: 0.95rem;';
        intro.textContent = 'U-16プログラミングコンテストは全国各地で開催されています。各地域の熱い戦いにもご注目ください。';
        container.appendChild(intro);

        // Grid layout for regional events
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;';

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass reveal-on-scroll';
            card.style.cssText = 'padding: 20px; display: flex; flex-direction: column; gap: 10px; transition: transform 0.2s;';
            card.onmouseover = () => card.style.transform = 'translateY(-3px)';
            card.onmouseout = () => card.style.transform = 'translateY(0)';

            let html = '';

            // Prefecture badge + Title
            if (item.prefecture) {
                html += `<span style="background: var(--secondary); color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: inline-block; width: fit-content;">${item.prefecture}</span>`;
            }
            html += `<h3 style="font-size: 1.1rem; color: var(--text-main); font-weight: 700;">${item.title}</h3>`;

            // Date
            if (item.start_date) {
                const dateStr = new Date(item.start_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
                const timeStr = item.start_time ? ` ${item.start_time}` : '';
                const endStr = item.end_time ? ` 〜 ${item.end_time}` : '';
                html += `<p style="color: var(--primary); font-size: 0.85rem;">📅 ${dateStr}${timeStr}${endStr}</p>`;
            }

            // Content
            if (item.content) {
                const shortContent = item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content;
                html += `<p style="color: var(--text-dim); font-size: 0.9rem; line-height: 1.6;">${shortContent}</p>`;
            }

            // Participants & divisions
            let metaHtml = '';
            if (item.participants) {
                metaHtml += `<span style="font-size: 0.8rem; color: var(--text-dim);">👥 ${item.participants}名</span>`;
            }
            if (item.divisions) {
                let divList = typeof item.divisions === 'string' ? JSON.parse(item.divisions) : item.divisions;
                if (divList && divList.length > 0) {
                    const hasSubdivision = divList.some(d => d.includes('競技部門 ('));
                    if (hasSubdivision) {
                        divList = divList.filter(d => d !== '競技部門');
                    }
                    metaHtml += `<span style="font-size: 0.8rem; color: var(--text-dim);">🏆 ${divList.join('・')}</span>`;
                }
            }
            if (metaHtml) {
                html += `<div style="display: flex; gap: 12px; flex-wrap: wrap;">${metaHtml}</div>`;
            }

            // Images (show first image as thumbnail)
            if (item.images && item.images.length > 0) {
                const imgs = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
                if (imgs.length > 0) {
                    html += `<img src="${imgs[0]}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-top: 5px;">`;
                }
            }

            // Link
            if (item.overview_url) {
                html += `<a href="${item.overview_url}" target="_blank" class="btn-outline" style="padding: 8px 15px; font-size: 0.85rem; text-align: center; margin-top: auto;">詳細を見る</a>`;
            }

            card.innerHTML = html;
            grid.appendChild(card);
            observer.observe(card);
        });

        container.appendChild(grid);

    } catch (e) {
        container.innerHTML = '<p style="text-align: center; color: #ff4b4b; padding: 20px;" class="glass">他所での開催情報の読み込みに失敗しました。</p>';
    }
});

function renderLegacyClassComp(compCard, item) {
    const title = item.title || '競技部門';
    const content = item.content || '';
    const imgHtml = item.image ? `<div style="margin-top: 20px; height: 180px; overflow: hidden; border-radius: 12px;"><img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;"></div>` : '';
    const linkHtml = item.link ? `<div style="margin-top: 15px;"><a href="${item.link}" target="_blank" class="btn-outline" style="padding: 8px 15px; font-size: 0.85rem;">もっと詳しく</a></div>` : '';
    compCard.innerHTML = `
        <div class="icon">競技</div>
        <h3>${title}</h3>
        <div><p>${content}</p></div>
        ${imgHtml}
        ${linkHtml}
    `;
}
