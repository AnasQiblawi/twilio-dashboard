let accounts = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Load components
    const navbarResponse = await fetch('../components/navbar.html');
    const footerResponse = await fetch('../components/footer.html');
    document.getElementById('navbar-placeholder').innerHTML = await navbarResponse.text();
    document.getElementById('footer-placeholder').innerHTML = await footerResponse.text();

    // Initialize form elements
    document.querySelectorAll('.form-outline').forEach((formOutline) => {
        new mdb.Input(formOutline).init();
    });

    // Load accounts for the dropdown
    await loadAccounts();

    // Initialize form submission
    document.getElementById('smsForm').addEventListener('submit', handleSendMessage);
});

async function loadAccounts() {
    try {
        const response = await fetch('/api/sms/accounts');
        accounts = await response.json();
        
        const accountSelect = document.getElementById('accountSelect');
        accounts.forEach((account, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${account.number} (${account.status})`;
            accountSelect.appendChild(option);
        });
    } catch (error) {
        showToast('Error loading accounts: ' + error.message, 'error');
    }
}

async function handleSendMessage(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';

    try {
        const formData = new FormData(e.target);
        const messageData = {
            to: formData.get('to'),
            message: formData.get('message'),
            accountIndex: formData.get('accountIndex')
        };

        const response = await fetch('/api/sms/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        });

        const result = await response.json();

        if (result.success) {
            addMessageToHistory(result.message);
            showToast('Message sent successfully!', 'success');
            e.target.reset();
        } else {
            showToast('Error sending message: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error sending message: ' + error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

function addMessageToHistory(message) {
    const recentMessages = document.getElementById('recentMessages');
    const messageElement = document.createElement('div');
    messageElement.className = 'alert alert-info mb-3';
    messageElement.innerHTML = `
        <strong>To:</strong> ${message.to}<br>
        <strong>From:</strong> ${message.from}<br>
        <strong>Status:</strong> ${message.status}<br>
        <strong>Message:</strong> ${message.body}<br>
        <small class="text-muted">Sent: ${new Date(message.dateSent).toLocaleString()}</small>
    `;
    recentMessages.insertBefore(messageElement, recentMessages.firstChild);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.remove('bg-success', 'bg-danger');
    toast.classList.add('bg-' + (type === 'success' ? 'success' : 'danger'));
    const toastInstance = new mdb.Toast(toast);
    toastInstance.show();
}

function handleTemplate() {
    const template = document.getElementById('template');
    const messageArea = document.getElementById('message');
    messageArea.value = template.value;
    new mdb.Input(messageArea.closest('.form-outline')).init();
}

// Make functions available globally
window.handleTemplate = handleTemplate;