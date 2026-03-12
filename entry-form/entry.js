const entryForm = document.getElementById('entry-form');
const confirmBtn = document.getElementById('confirm-btn');
const backBtn = document.getElementById('back-btn');
const submitBtn = document.getElementById('submit-btn');

const formContainer = document.getElementById('form-container');
const confirmationView = document.getElementById('confirmation-view');
const successView = document.getElementById('success-view');

const fields = ['name', 'school', 'email', 'division', 'title', 'description'];

confirmBtn.addEventListener('click', () => {
    if (entryForm.checkValidity()) {
        const formData = new FormData(entryForm);
        fields.forEach(field => {
            const displayEl = document.getElementById(`confirm-${field}`);
            if (displayEl) displayEl.textContent = formData.get(field);
        });

        formContainer.style.display = 'none';
        confirmationView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        entryForm.reportValidity();
    }
});

backBtn.addEventListener('click', () => {
    confirmationView.style.display = 'none';
    formContainer.style.display = 'block';
});

submitBtn.addEventListener('click', () => {
    const formData = new FormData(entryForm);

    // Simulation of entry processing
    console.log("%c--- New Tournament Entry ---", "color: #00d2ff; font-weight: bold;");
    fields.forEach(field => {
        console.log(`${field.toUpperCase()}: ${formData.get(field)}`);
    });

    confirmationView.style.display = 'none';
    successView.style.display = 'block';
});
