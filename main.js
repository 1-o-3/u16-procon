// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.style.padding = '15px 0';
        header.style.background = 'rgba(10, 11, 30, 0.95)';
    } else {
        header.style.padding = '20px 0';
        header.style.background = 'rgba(10, 11, 30, 0.7)';
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
                <h3 style="font-size: 1.2rem; color: white;">${item.title}</h3>
                <p style="color: var(--text-dim); font-size: 0.95rem; white-space: pre-wrap;">${item.content}</p>
            `;
            
            if (hasSubinfo) {
                html += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 5px; font-size: 0.9rem;">`;
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
                const titleEl = document.getElementById('hp-class-comp-title');
                const contentEl = document.getElementById('hp-class-comp-content');
                const imgContainer = document.getElementById('hp-class-comp-img-container');
                
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
            }
        });

    } catch (e) {
        console.error("Failed to load fixed content", e);
    }
});
