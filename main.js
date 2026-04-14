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
