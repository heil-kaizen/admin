document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const refreshBtn = document.getElementById('refresh-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Check if already logged in
    if (sessionStorage.getItem('adminPassword')) {
        showDashboard();
    }

    loginBtn.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminPassword');
        dashboardScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        passwordInput.value = '';
    });

    refreshBtn.addEventListener('click', loadData);

    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) {
            loginError.textContent = 'Please enter a password';
            return;
        }

        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        // Test the password by making a request
        try {
            const response = await fetch('/api/cpu-top10', {
                headers: {
                    'x-admin-password': password
                }
            });

            if (response.ok) {
                sessionStorage.setItem('adminPassword', password);
                loginError.textContent = '';
                showDashboard();
            } else {
                loginError.textContent = 'Invalid password';
            }
        } catch (error) {
            loginError.textContent = 'Error connecting to server';
        } finally {
            loginBtn.textContent = 'Login';
            loginBtn.disabled = false;
        }
    }

    function showDashboard() {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        loadData();
    }

    async function loadData() {
        refreshBtn.textContent = 'Refreshing...';
        refreshBtn.disabled = true;

        const password = sessionStorage.getItem('adminPassword');

        try {
            const [cpuResponse, pvpResponse] = await Promise.all([
                fetch('/api/cpu-top10', { headers: { 'x-admin-password': password } }),
                fetch('/api/pvp-top10', { headers: { 'x-admin-password': password } })
            ]);

            if (cpuResponse.status === 401 || pvpResponse.status === 401) {
                // Password became invalid somehow
                logoutBtn.click();
                return;
            }

            const cpuData = await cpuResponse.json();
            const pvpData = await pvpResponse.json();

            populateTable('cpu-table', cpuData, 'local_wins');
            populateTable('pvp-table', pvpData, 'online_winnings');
        } catch (error) {
            console.error('Failed to load data:', error);
            alert('Failed to load data. See console for details.');
        } finally {
            refreshBtn.textContent = 'Refresh Data';
            refreshBtn.disabled = false;
        }
    }

    function populateTable(tableId, data, statKey) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No data found</td></tr>';
            return;
        }

        data.forEach((user, index) => {
            const tr = document.createElement('tr');
            
            const walletDisplay = user.wallet_address 
                ? `${user.wallet_address.substring(0, 6)}...${user.wallet_address.substring(user.wallet_address.length - 4)}` 
                : 'N/A';

            tr.innerHTML = `
                <td>#${index + 1}</td>
                <td>${escapeHtml(user.username || 'Unknown')}</td>
                <td class="wallet-address" title="${user.wallet_address || ''}">${walletDisplay}</td>
                <td>${user[statKey] || 0}</td>
                <td>
                    ${user.wallet_address 
                        ? \`<button class="copy-btn" data-wallet="${user.wallet_address}">Copy Wallet</button>\` 
                        : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add copy event listeners
        const copyBtns = tbody.querySelectorAll('.copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const wallet = this.getAttribute('data-wallet');
                copyToClipboard(wallet, this);
            });
        });
    }

    function copyToClipboard(text, buttonElement) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'Copied!';
            buttonElement.classList.add('copied');
            
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('Failed to copy to clipboard');
        });
    }

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
