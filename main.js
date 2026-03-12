// Contact Form Logic
const contactForm = document.getElementById('contact-form');
const confirmBtn = document.getElementById('confirm-btn');
const backBtn = document.getElementById('back-btn');
const submitBtn = document.getElementById('submit-btn');

const formContainer = document.getElementById('form-container');
const confirmationView = document.getElementById('confirmation-view');
const successView = document.getElementById('success-view');

// Form data mapping
const confirmFields = {
    genre: document.getElementById('confirm-genre'),
    name: document.getElementById('confirm-name'),
    email: document.getElementById('confirm-email'),
    subject: document.getElementById('confirm-subject'),
    message: document.getElementById('confirm-message')
};

confirmBtn.addEventListener('click', () => {
    if (contactForm.checkValidity()) {
        const formData = new FormData(contactForm);

        confirmFields.genre.textContent = formData.get('genre');
        confirmFields.name.textContent = formData.get('name');
        confirmFields.email.textContent = formData.get('email');
        confirmFields.subject.textContent = formData.get('subject');
        confirmFields.message.textContent = formData.get('message');

        formContainer.style.display = 'none';
        confirmationView.style.display = 'block';
        window.scrollTo({ top: confirmationView.offsetTop - 100, behavior: 'smooth' });
    } else {
        contactForm.reportValidity();
    }
});

backBtn.addEventListener('click', () => {
    confirmationView.style.display = 'none';
    formContainer.style.display = 'block';
});

submitBtn.addEventListener('click', () => {
    const formData = new FormData(contactForm);
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;

    // Constructing the terminal logs to simulate the email logic requested
    console.log("%c--- Sending Email to u16.shizuoka@gmail.com ---", "color: #00d2ff; font-weight: bold;");
    console.log(`Subject: ${formData.get('genre')}`);
    console.log(`From: ${formData.get('email')}`);
    console.log(`Body:\n【${formData.get('name')}】様からのお問い合わせ\n${formData.get('subject')}\n\n${formData.get('message')}`);

    console.log("%c--- Sending Confirmation to " + formData.get('email') + " ---", "color: #00a86b; font-weight: bold;");
    const autoReplyBody = `
${formData.get('name')} 様　お問い合わせありがとうございます
以下の内容でお問い合わせを承りました

ーーーーーーーーーーーーーーーーーーーーーーーー

お問い合わせ日：${dateStr}
ジャンル：${formData.get('genre')}
件名：${formData.get('subject')}
本文：
${formData.get('message')}

ーーーーーーーーーーーーーーーーーーーーーーーー

順次返信いたしますので、しばらくお待ちください


U-16プログラミングコンテスト静岡大会 実行委員会`;
    console.log("Subject: お問い合わせが完了しました");
    console.log("Body:" + autoReplyBody);

    // Show success
    confirmationView.style.display = 'none';
    successView.style.display = 'block';
});

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
