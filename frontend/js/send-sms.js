// send-sms.js
let accounts = [];
let messageHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initializePage();
    setupEventListeners();
    loadMessageHistory();
});

async function initializePage() {
    // Load components
    await Promise.all([
        loadComponent('navbar-placeholder', '../components/navbar.html'),
        loadComponent('footer-placeholder', '../components/footer.html')
    ]);

    // Initialize MDBootstrap components
    document.querySelectorAll('.form-outline').forEach((formOutline) => {
        new mdb.Input(formOutline).init();
    });

    await loadAccounts();
}

function setupEventListeners() {
    // Form submission
    document.getElementById('smsForm').addEventListener('submit', handleSendMessage);
    
    // Character counter
    document.getElementById('message').addEventListener('input', updateCharacterCount);
    
    // Account selection
    document.getElementById('accountSelect').addEventListener('change', updateAccountInfo);
}

async function loadAccounts() {
    try {
        const response = await fetch('/api/sms/accounts');
        accounts = await response.json();
        
        const accountSelect = document.getElementById('accountSelect');
        accounts.forEach((account, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${account.number} (${formatBalance(account.balance)})`;
            accountSelect.appendChild(option);
        });

        updateAccountInfo();
    } catch (error) {
        showToast('Error loading accounts: ' + error.message, 'error');
    }
}

function updateAccountInfo() {
    const selectedIndex = document.getElementById('accountSelect').value;
    const accountBalance = document.getElementById('accountBalance');
    
    if (selectedIndex !== "") {
        const account = accounts[selectedIndex];
        accountBalance.textContent = `Balance: ${formatBalance(account.balance)}`;
    } else {
        accountBalance.textContent = '';
    }
}

function formatBalance(balance) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(balance);
}

function updateCharacterCount(e) {
    const charCount = document.getElementById('charCount');
    const count = e.target.value.length;
    charCount.textContent = `${count}/1600 characters`;
    charCount.classList.toggle('text-danger', count > 1600);
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
            accountIndex: formData.get('accountIndex') || undefined
        };

        const response = await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });

        const result = await response.json();

        if (result.success) {
            addMessageToHistory(result.message);
            showToast('Message sent successfully!', 'success');
            e.target.reset();
            document.querySelectorAll('.form-outline').forEach((formOutline) => {
                new mdb.Input(formOutline).init();
            });
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
    messageHistory.unshift(message);
    if (messageHistory.length > 10) messageHistory.pop();
    saveMessageHistory();
    renderMessageHistory();
}

function renderMessageHistory() {
    const recentMessages = document.getElementById('recentMessages');
    recentMessages.innerHTML = messageHistory.map(message => `
        <div class="alert alert-info mb-3 position-relative">
            <div class="d-flex justify-content-between">
                <div>
                    <strong>To:</strong> ${message.to}<br>
                    <strong>From:</strong> ${message.from}<br>
                    <strong>Status:</strong> 
                    <span class="badge bg-${getStatusColor(message.status)}">
                        ${message.status}
                    </span><br>
                    <strong>Message:</strong> ${message.body}<br>
                    <small class="text-muted">
                        Sent: ${new Date(message.dateSent).toLocaleString()}
                    </small>
                </div>
                <div>
                    ${message.price ? `
                        <span class="badge bg-primary">
                            ${message.price} ${message.priceUnit}
                        </span>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function getStatusColor(status) {
    const colors = {
        'queued': 'warning',
        'sent': 'info',
        'delivered': 'success',
        'failed': 'danger',
        'undelivered': 'danger'
    };
    return colors[status.toLowerCase()] || 'secondary';
}

function clearHistory() {
    messageHistory = [];
    saveMessageHistory();
    renderMessageHistory();
    showToast('Message history cleared', 'info');
}

function saveMessageHistory() {
    localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
}

function loadMessageHistory() {
    const saved = localStorage.getItem('messageHistory');
    if (saved) {
        messageHistory = JSON.parse(saved);
        renderMessageHistory();
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toast.classList.remove('bg-success', 'bg-danger', 'bg-info');
    toast.classList.add(`bg-${type}`);
    
    toastMessage.textContent = message;
    toast.classList.remove('bg-success', 'bg-danger');
    toast.classList.add('bg-' + (type === 'success' ? 'success' : 'danger'));
    
    const toastInstance = new mdb.Toast(toast);
    toastInstance.show();
}

// Template handling
function handleTemplate() {
    const template = document.getElementById('template');
    const messageArea = document.getElementById('message');
    messageArea.value = template.value;
    new mdb.Input(messageArea.closest('.form-outline')).init();
    updateCharacterCount({ target: messageArea });
}

// Helper function to load components
async function loadComponent(elementId, path) {
    try {
        const response = await fetch(path);
        document.getElementById(elementId).innerHTML = await response.text();
    } catch (error) {
        console.error(`Error loading component ${path}:`, error);
    }
}

// Make necessary functions available globally
window.handleTemplate = handleTemplate;
window.clearHistory = clearHistory;