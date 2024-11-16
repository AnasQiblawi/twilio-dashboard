let accounts = [];
let filteredAccounts = [];
let usageChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Load components
    const navbarResponse = await fetch('../components/navbar.html');
    const footerResponse = await fetch('../components/footer.html');
    document.getElementById('navbar-placeholder').innerHTML = await navbarResponse.text();
    document.getElementById('footer-placeholder').innerHTML = await footerResponse.text();

    // Load accounts
    await loadAccounts();
    updateSummary();
    renderAccounts();
    // Load the add account modal
    await loadAddAccountModal();
});

async function loadAccounts() {
    try {
        const response = await fetch('/api/sms/accounts');
        accounts = await response.json();
        filteredAccounts = [...accounts];
    } catch (error) {
        showToast('Error loading accounts: ' + error.message, 'error');
    }
}

function updateSummary() {
    const totalAccounts = filteredAccounts.length;
    const activeAccounts = filteredAccounts.filter(a => a.status === 'active').length;
    const totalBalance = filteredAccounts.reduce((sum, account) => sum + account.balance, 0);
    const avgBalance = totalBalance / totalAccounts || 0;

    document.getElementById('totalAccounts').textContent = totalAccounts;
    document.getElementById('activeAccounts').textContent = activeAccounts;
    document.getElementById('totalBalance').textContent = `$${totalBalance.toFixed(2)}`;
    document.getElementById('avgBalance').textContent = `$${avgBalance.toFixed(2)}`;
}

function renderAccounts() {
    const accountsList = document.getElementById('accountsList');
    accountsList.innerHTML = filteredAccounts.map(account => `
        <tr>
            <td>
                <input type="checkbox" class="form-check-input" value="${account.sid}">
            </td>
            <td>${account.number}</td>
            <td>${account.sid}</td>
            <td>
                <span class="badge bg-info">${account.type}</span>
            </td>
            <td>
                <span class="badge bg-${account.status === 'active' ? 'success' : 'danger'}">
                    ${account.status}
                </span>
            </td>
            <td>$${account.balance}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="showAccountDetails('${account.sid}')">
                    <i class="fas fa-info-circle"></i>
                </button>
                <button class="btn btn-sm btn-warning ms-1" onclick="refreshBalance('${account.sid}')">
                    <i class="fas fa-sync"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function showAccountDetails(sid) {
    const account = accounts.find(a => a.sid === sid);
    if (!account) return;

    const accountDetails = document.getElementById('accountDetails');
    accountDetails.innerHTML = `
        <div class="mb-3">
            <strong>Phone Number:</strong> ${account.number}
        </div>
        <div class="mb-3">
            <strong>SID:</strong> ${account.sid}
        </div>
        <div class="mb-3">
            <strong>Type:</strong> ${account.type}
        </div>
        <div class="mb-3">
            <strong>Status:</strong> 
            <select class="form-select" id="accountStatus">
                <option value="active" ${account.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="suspended" ${account.status === 'suspended' ? 'selected' : ''}>Suspended</option>
            </select>
        </div>
        <div class="mb-3">
            <strong>Balance:</strong> $${account.balance}
            <button class="btn btn-sm btn-warning ms-2" onclick="refreshBalance('${account.sid}')">
                <i class="fas fa-sync"></i> Refresh
            </button>
        </div>
        <div class="mb-3">
            <strong>Last Updated:</strong> ${account.dateUpdated || 'Never'}
        </div>
        <button class="btn btn-primary" onclick="saveAccountChanges('${account.sid}')">
            Save Changes
        </button>
    `;

    // Show the modal after updating content
    const modalElement = document.getElementById('accountModal');
    const modal = new mdb.Modal(modalElement);
    modal.show();

    // // Create usage chart if needed
    // createUsageChart({
    //     labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    //     values: [65, 59, 80, 81, 56, 55]
    // });

    
    // Show loading state for chart
    const ctx = document.getElementById('usageChart').getContext('2d');
    ctx.font = '16px Arial';
    ctx.fillText('Loading usage data...', 10, 50);

    try {
        // Fetch usage data
        const response = await fetch(`/api/sms/accounts/${sid}/usage`);
        const data = await response.json();

        if (data.success) {
            const usage = data.usage;
            createUsageChart({
                labels: Object.keys(usage),
                values: Object.values(usage)
            });
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        const ctx = document.getElementById('usageChart').getContext('2d');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = 'red';
        ctx.fillText('Error loading usage data: ' + error.message, 10, 50);
    }
}


function createUsageChart(data) {
    const ctx = document.getElementById('usageChart').getContext('2d');
    
    if (usageChart) {
        usageChart.destroy();
    }

    usageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Messages Sent',
                data: data.values,
                borderColor: '#1266F1',
                backgroundColor: 'rgba(18, 102, 241, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Monthly SMS Usage'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 1000
            }
        }
    });
}

async function refreshBalance(sid) {
    // In a real app, this would fetch the latest balance from Twilio
    showToast('Balance refreshed successfully', 'success');
}

function applyFilters() {
    const status = document.getElementById('statusFilter').value;
    const type = document.getElementById('typeFilter').value;
    const minBalance = parseFloat(document.getElementById('balanceFilter').value) || 0;

    filteredAccounts = accounts.filter(account => {
        if (status && account.status !== status) return false;
        if (type && account.type !== type) return false;
        if (minBalance && account.balance < minBalance) return false;
        return true;
    });

    updateSummary();
    renderAccounts();
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('#accountsList input[type="checkbox"]');
    const selectAll = document.getElementById('selectAll');
    checkboxes.forEach(checkbox => checkbox.checked = selectAll.checked);
}

function exportAccounts(format) {
    const selectedAccounts = [...document.querySelectorAll('#accountsList input[type="checkbox"]:checked')]
        .map(checkbox => accounts.find(a => a.sid === checkbox.value));

    if (selectedAccounts.length === 0) {
        showToast('Please select accounts to export', 'error');
        return;
    }

    let content;
    let filename;
    let type;

    if (format === 'csv') {
        const headers = ['Phone Number', 'SID', 'Type', 'Status', 'Balance'];
        const csvContent = [
            headers.join(','),
            ...selectedAccounts.map(account => 
                [account.number, account.sid, account.type, account.status, account.balance].join(',')
            )
        ].join('\n');
        
        content = csvContent;
        filename = 'twilio_accounts.csv';
        type = 'text/csv';
    } else {
        content = JSON.stringify(selectedAccounts, null, 2);
        filename = 'twilio_accounts.json';
        type = 'application/json';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Accounts exported as ${format.toUpperCase()}`, 'success');
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.add('bg-' + (type === 'success' ? 'success' : 'danger'));
    const toastInstance = new mdb.Toast(toast);
    toastInstance.show();
}


async function refreshAllAccounts() {
    try {
        const refreshButton = document.getElementById('refreshAllBtn');
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

        const response = await fetch('/api/sms/accounts/refresh-all', {
            method: 'POST'
        });
        const results = await response.json();

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        if (failCount > 0) {
            showToast(`Refreshed ${successCount} accounts. ${failCount} failed.`, 'warning');
        } else {
            showToast('All accounts refreshed successfully', 'success');
        }

        // Reload accounts
        await loadAccounts();
        updateSummary();
        renderAccounts();
    } catch (error) {
        showToast('Error refreshing accounts: ' + error.message, 'error');
    } finally {
        const refreshButton = document.getElementById('refreshAllBtn');
        refreshButton.disabled = false;
        refreshButton.innerHTML = '<i class="fas fa-sync"></i> Refresh All';
    }
}

async function refreshBalance(sid) {
    try {
        const response = await fetch(`/api/sms/accounts/${sid}/refresh`);
        const result = await response.json();

        if (result.success) {
            // Update the account in our local array
            const index = accounts.findIndex(a => a.sid === sid);
            if (index !== -1) {
                accounts[index] = result.account;
                filteredAccounts = [...accounts];
                updateSummary();
                renderAccounts();
            }
            showToast('Balance refreshed successfully', 'success');
        } else {
            showToast('Error refreshing balance: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error refreshing balance: ' + error.message, 'error');
    }
}

async function updateAccount(sid, data) {
    try {
        const response = await fetch(`/api/sms/accounts/${sid}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
            // Update the account in our local array
            const index = accounts.findIndex(a => a.sid === sid);
            if (index !== -1) {
                accounts[index] = result.account;
                filteredAccounts = [...accounts];
                updateSummary();
                renderAccounts();
            }
            showToast('Account updated successfully', 'success');
        } else {
            showToast('Error updating account: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error updating account: ' + error.message, 'error');
    }
}

// Update the showAccountDetails function to include edit functionality


function saveAccountChanges(sid) {
    const status = document.getElementById('accountStatus').value;
    updateAccount(sid, { status });
}



async function loadAddAccountModal() {
    try {
        const response = await fetch('../components/add-account-modal.html');
        const modalHtml = await response.text();
        document.getElementById('addAccountModalPlaceholder').innerHTML = modalHtml;
       
        // Initialize form event listener
        document.getElementById('addAccountForm').addEventListener('submit', handleAddAccount);
       
        // Let's skip the MDB initialization for now
        return true;
    } catch (error) {
        console.error('Error loading modal:', error);
        return false;
    }
}

function showAddAccountModal() {
    const modalElement = document.getElementById('addAccountModal');
    if (!modalElement) {
        console.error('Modal element not found');
        return;
    }
    
    // Try to initialize form elements right before showing the modal
    try {
        document.querySelectorAll('#addAccountModal .form-outline').forEach((formOutline) => {
            if (formOutline.querySelector('input')) {
                mdb.Input.getInstance(formOutline) || new mdb.Input(formOutline).init();
            }
        });
    } catch (e) {
        console.warn('MDB initialization skipped:', e);
    }

    const modal = new mdb.Modal(modalElement);
    modal.show();
}


async function handleAddAccount(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Verifying...';

    try {
        const formData = new FormData(e.target);
        const accountData = Object.fromEntries(formData);

        const response = await fetch('/api/sms/accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(accountData)
        });

        const result = await response.json();

        if (result.success) {
            // Add new account to local arrays
            accounts.push(result.account);
            filteredAccounts = [...accounts];
            
            // Update UI
            updateSummary();
            renderAccounts();
            
            // Close modal and show success message
            const modal = mdb.Modal.getInstance(document.getElementById('addAccountModal'));
            modal.hide();
            showToast('Account added successfully', 'success');
            
            // Reset form
            e.target.reset();
        } else {
            showToast('Error adding account: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error adding account: ' + error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}





// Make functions available globally
window.showAccountDetails = showAccountDetails;
window.refreshBalance = refreshBalance;
window.applyFilters = applyFilters;
window.toggleSelectAll = toggleSelectAll;
window.exportAccounts = exportAccounts;
window.refreshAllAccounts = refreshAllAccounts;
window.saveAccountChanges = saveAccountChanges;
window.showAddAccountModal = showAddAccountModal;