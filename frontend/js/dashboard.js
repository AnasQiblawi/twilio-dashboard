document.addEventListener('DOMContentLoaded', async () => {
    // Load components
    const navbarResponse = await fetch('../components/navbar.html');
    const footerResponse = await fetch('../components/footer.html');
    document.getElementById('navbar-placeholder').innerHTML = await navbarResponse.text();
    document.getElementById('footer-placeholder').innerHTML = await footerResponse.text();

    // Load account data
    const accountsResponse = await fetch('/api/sms/accounts');
    const accounts = await accountsResponse.json();
    
    // Render account cards
    const accountCards = document.getElementById('account-cards');
    accountCards.innerHTML = accounts.map(account => `
        <div class="col-md-4 mb-4">
            <div class="card account-card">
                <div class="card-body">
                    <h5 class="card-title">
                        <i class="fas fa-phone-alt me-2"></i>${account.number}
                    </h5>
                    <p class="card-text">
                        <span class="badge bg-${account.status === 'active' ? 'success' : 'danger'} mb-2">
                            ${account.status}
                        </span>
                        <span class="badge bg-info mb-2">${account.type}</span>
                        <br>
                        Balance: $${account.balance}
                    </p>
                </div>
            </div>
        </div>
    `).join('');
});