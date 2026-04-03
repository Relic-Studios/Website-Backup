// Simplified Contact Form Handler

function initContactForm() {
    const form = document.getElementById('contact-form');
    const statusDiv = document.getElementById('form-status');

    if (!form) return;

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Basic validation
        const fields = new FormData(form);
        const name = fields.get('name');
        const email = fields.get('email');
        const projectType = fields.get('projectType');
        const message = fields.get('message');

        if (!name || !email || !projectType || !message) {
            showStatus('error', 'Please fill in all required fields.');
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('.submit-button');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;

        try {
            // Submit to Web3Forms API
            const formData = new FormData(form);

            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showStatus('success', 'Thanks for your inquiry! We\'ll get back to you within 24 hours.');
                form.reset();
            } else {
                throw new Error(result.message || 'Submission failed');
            }

        } catch (error) {
            console.error('Form submission error:', error);
            showStatus('error', 'Sorry, there was an error sending your inquiry. Please try again or contact us at relicvisuals404@gmail.com');
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });

    function showStatus(type, message) {
        if (!statusDiv) return;

        statusDiv.className = `form-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';

        // Auto-hide after 10 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 10000);
    }

}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactForm);
} else {
    initContactForm();
}
