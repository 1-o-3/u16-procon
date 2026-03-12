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
