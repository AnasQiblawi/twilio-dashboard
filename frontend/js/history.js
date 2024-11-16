let messages = [];
let currentPage = 1;
const messagesPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    // Load components
    const navbarResponse = await fetch('../components/navbar.html');
    const footerResponse = await fetch('../components/footer.html');
    document.getElementById('navbar-placeholder').innerHTML = await navbarResponse.text();
    document.getElementById('footer-placeholder').innerHTML = await footerResponse.text();

    // Load accounts for filter
    const accountsResponse = await fetch('/api/sms/accounts');
    const accounts = await accountsResponse.json();
    
    const accountFilter = document.getElementById('accountFilter');
    accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.number;
        option.textContent = account.number;
        accountFilter.appendChild(option);
    });

    // Load initial messages
    loadMessages();
});

async function loadMessages() {
    // In a real app, this would fetch from the server
    messages = [
        {
            date: '2024-11-16',
            to: '+1234567890',
            from: '+15139605437',
            message: 'Test message',
            status: 'delivered',
            cost: '0.0075'
        }
        // Add more mock messages here
    ];

    renderMessages();
    renderPagination();
}

function renderMessages() {
    const start = (currentPage - 1) * messagesPerPage;
    const end = start + messagesPerPage;
    const pageMessages = messages.slice(start, end);

    const messageList = document.getElementById('messageList');
    messageList.innerHTML = pageMessages.map(msg => `
        <tr>
            <td>${msg.date}</td>
            <td>${msg.to}</td>
            <td>${msg.from}</td>
            <td>${msg.message}</td>
            <td>
                <span class="badge bg-${msg.status === 'delivered' ? 'success' : 
                                     msg.status === 'failed' ? 'danger' : 'info'}">
                    ${msg.status}
                </span>
            </td>
            <td>$${msg.cost}</td>
        </tr>
    `).join('');
}

function renderPagination() {
    const totalPages = Math.ceil(messages.length / messagesPerPage);
    const pagination = document.getElementById('pagination');
    
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
    
    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    renderMessages();
    renderPagination();
}

function applyFilters() {
    const account = document.getElementById('accountFilter').value;
    const date = document.getElementById('dateFilter').value;
    const status = document.getElementById('statusFilter').value;

    // Filter messages based on selected criteria
    loadMessages(); // In a real app, this would include filter parameters
}

window.changePage = changePage;
window.applyFilters = applyFilters;