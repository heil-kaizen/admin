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
        setTimeout(() => loginScreen.classList.remove('hidden'), 50); // slight delay for transition
        passwordInput.value = '';
    });

    refreshBtn.addEventListener('click', loadData);

    async function handleLogin() {
        const password = passwordInput.value;
        if (!password) {
            loginError.textContent = 'Please enter a password';
            return;
        }

        const originalBtnHTML = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span> Authenticating...</span>';
        loginBtn.disabled = true;
        loginError.textContent = '';

        try {
            const response = await fetch('/api/cpu-top10', {
                headers: { 'x-admin-password': password }
            });

            if (response.ok) {
                sessionStorage.setItem('adminPassword', password);
                showDashboard();
            } else if (response.status === 401) {
                loginError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Invalid password.';
            } else if (response.status === 500) {
                loginError.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Server Error. Check Vercel Environment Variables (SUPABASE_URL, etc).';
            } else {
                loginError.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Error: ${response.statusText}`;
            }
        } catch (error) {
            console.error(error);
            loginError.innerHTML = '<i class="fa-solid fa-wifi"></i> Error connecting to server. Is the API deployed?';
        } finally {
            loginBtn.innerHTML = originalBtnHTML;
            loginBtn.disabled = false;
        }
    }

    function showDashboard() {
        loginScreen.classList.add('hidden');
        setTimeout(() => dashboardScreen.classList.remove('hidden'), 50);
        loadData();
    }

    async function loadData() {
        const originalBtnHTML = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;

        const password = sessionStorage.getItem('adminPassword');

        try {
            const [cpuResponse, pvpResponse] = await Promise.all([
                fetch('/api/cpu-top10', { headers: { 'x-admin-password': password } }),
                fetch('/api/pvp-top10', { headers: { 'x-admin-password': password } })
            ]);

            if (cpuResponse.status === 401 || pvpResponse.status === 401) {
                logoutBtn.click();
                return;
            }

            if (!cpuResponse.ok || !pvpResponse.ok) {
                throw new Error("Failed to fetch data. Check Vercel Environment variables.");
            }

            const cpuData = await cpuResponse.json();
            const pvpData = await pvpResponse.json();

            populateTable('cpu-table', cpuData, 'local_wins');
            populateTable('pvp-table', pvpData, 'online_winnings');
        } catch (error) {
            console.error('Failed to load data:', error);
            alert(error.message);
        } finally {
            refreshBtn.innerHTML = originalBtnHTML;
            refreshBtn.disabled = false;
        }
    }

    function populateTable(tableId, data, statKey) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No data found</td></tr>';
            return;
        }

        data.forEach((user, index) => {
            const tr = document.createElement('tr');
            
            // Add classes for top 3 rows
            if (index < 3) {
                tr.className = `rank-${index + 1}`;
            }
            
            const walletDisplay = user.wallet_address 
                ? `${user.wallet_address.substring(0, 6)}...${user.wallet_address.substring(user.wallet_address.length - 4)}` 
                : 'N/A';

            const statFormatted = user[statKey] 
                ? (statKey === 'online_winnings' ? parseFloat(user[statKey]).toFixed(2) + ' SOL' : user[statKey])
                : '0';

            tr.innerHTML = `
                <td><div class="rank-badge">#${index + 1}</div></td>
                <td style="font-weight: 500;">${escapeHtml(user.username || 'Unknown')}</td>
                <td>
                    ${user.wallet_address ? `<span class="wallet-address" title="${user.wallet_address}">${walletDisplay}</span>` : '<span style="color:#64748b">N/A</span>'}
                </td>
                <td class="stat-val">${statFormatted}</td>
                <td>
                    ${user.wallet_address 
                        ? `<button class="copy-action-btn" data-wallet="${user.wallet_address}">
                             <i class="fa-regular fa-copy"></i> Copy
                           </button>` 
                        : '<span style="color:#64748b">-</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add copy event listeners
        const copyBtns = tbody.querySelectorAll('.copy-action-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const wallet = this.getAttribute('data-wallet');
                copyToClipboard(wallet, this);
            });
        });
    }

    function copyToClipboard(text, buttonElement) {
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            buttonElement.classList.add('copied');
            
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
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
