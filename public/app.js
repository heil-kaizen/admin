document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const refreshBtn = document.getElementById('refresh-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const wipeoutBtn = document.getElementById('wipeout-btn');

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

    if (wipeoutBtn) {
        wipeoutBtn.addEventListener('click', handleWipeout);
    }

    async function handleWipeout() {
        const confirmText = prompt('WARNING: This will reset all leaderboard stats to 0. Type "WIPEOUT" to confirm.');
        if (confirmText !== 'WIPEOUT') {
            alert('Wipeout cancelled.');
            return;
        }

        const password = sessionStorage.getItem('adminPassword');
        const originalBtnHTML = wipeoutBtn.innerHTML;
        wipeoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Wiping...';
        wipeoutBtn.disabled = true;

        try {
            const response = await fetch('/api/wipeout', {
                method: 'POST',
                headers: { 'x-admin-password': password }
            });

            if (response.ok) {
                alert('Database wiped out successfully!');
                loadData(); // Refresh the empty leaderboards
            } else {
                const errorData = await response.json();
                alert('Failed to wipeout: ' + (errorData.error || response.statusText));
            }
        } catch (error) {
            console.error('Failed to wipeout:', error);
            alert('Error connecting to server.');
        } finally {
            wipeoutBtn.innerHTML = originalBtnHTML;
            wipeoutBtn.disabled = false;
        }
    }

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
        initAdminFeatures();
    }

    let statsInterval;
    let currentSearchedWallet = null;
    let currentBanStatus = false;

    function initAdminFeatures() {
        if (statsInterval) clearInterval(statsInterval);
        fetchStats();
        fetchSolBalance();
        statsInterval = setInterval(fetchStats, 5000);

        // Ban System
        document.getElementById('ban-search-btn').addEventListener('click', async () => {
            const query = document.getElementById('ban-search').value.trim();
            if (!query) return;
            try {
                const res = await fetch(`/api/admin/search?query=${encodeURIComponent(query)}`, {
                    headers: { 'x-admin-password': sessionStorage.getItem('adminPassword') }
                });
                const data = await res.json();
                if (data && data.length > 0) {
                    const user = data[0];
                    currentSearchedWallet = user.wallet_address;
                    currentBanStatus = user.is_banned;
                    
                    document.getElementById('ban-detail-user').textContent = user.username || 'N/A';
                    document.getElementById('ban-detail-wallet').textContent = user.wallet_address;
                    document.getElementById('ban-detail-status').textContent = user.is_banned ? 'BANNED' : 'Active';
                    document.getElementById('ban-detail-status').style.color = user.is_banned ? '#ef4444' : '#10b981';
                    
                    const banBtn = document.getElementById('ban-toggle-btn');
                    banBtn.textContent = user.is_banned ? 'UNBAN USER' : 'BAN USER';
                    banBtn.className = user.is_banned ? 'primary-btn' : 'danger-btn wipeout';
                    
                    document.getElementById('ban-user-details').style.display = 'block';
                } else {
                    alert('User not found');
                    document.getElementById('ban-user-details').style.display = 'none';
                }
            } catch (err) {
                console.error(err);
                alert('Search failed');
            }
        });

        document.getElementById('ban-toggle-btn').addEventListener('click', async () => {
            if (!currentSearchedWallet) return;
            const newStatus = !currentBanStatus;
            try {
                const res = await fetch('/api/admin/ban', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-password': sessionStorage.getItem('adminPassword') },
                    body: JSON.stringify({ wallet_address: currentSearchedWallet, is_banned: newStatus })
                });
                if (res.ok) {
                    alert(`User ${newStatus ? 'banned' : 'unbanned'} successfully.`);
                    document.getElementById('ban-search-btn').click(); // Refresh search
                } else {
                    const errorData = await res.json();
                    alert('Failed: ' + errorData.error);
                }
            } catch (err) {
                console.error(err);
            }
        });

        // Broadcast
        document.getElementById('broadcast-btn').addEventListener('click', async () => {
            const msg = document.getElementById('broadcast-msg').value.trim();
            if (!msg) return;
            try {
                const res = await fetch('/api/admin/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-password': sessionStorage.getItem('adminPassword') },
                    body: JSON.stringify({ message: msg })
                });
                if (res.ok) {
                    alert('Broadcast sent!');
                    document.getElementById('broadcast-msg').value = '';
                } else {
                    const errorData = await res.json();
                    alert('Failed: ' + errorData.error);
                }
            } catch (err) {
                console.error(err);
            }
        });

        // Economy
        document.getElementById('eco-btn').addEventListener('click', async () => {
            const wallet = document.getElementById('eco-wallet').value.trim();
            const amount = parseInt(document.getElementById('eco-amount').value.trim(), 10);
            if (!wallet || isNaN(amount)) return alert('Enter wallet and amount');
            
            try {
                const res = await fetch('/api/admin/economy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-password': sessionStorage.getItem('adminPassword') },
                    body: JSON.stringify({ wallet_address: wallet, amount })
                });
                if (res.ok) {
                    const data = await res.json();
                    alert(`Balance updated successfully! New Balance: ${data.newBalance}`);
                    document.getElementById('eco-wallet').value = '';
                    document.getElementById('eco-amount').value = '';
                } else {
                    const errorData = await res.json();
                    alert('Failed: ' + errorData.error);
                }
            } catch (err) {
                console.error(err);
            }
        });

        document.getElementById('faucet-override-btn').addEventListener('click', async () => {
            try {
                const res = await fetch('/api/admin/faucet-override', {
                    method: 'POST',
                    headers: { 'x-admin-password': sessionStorage.getItem('adminPassword') }
                });
                if (res.ok) {
                    document.getElementById('faucet-status-text').textContent = 'Override Active! (Expires in 1 Hour)';
                    document.getElementById('faucet-status-text').style.color = '#10b981';
                } else {
                    const errorData = await res.json();
                    alert('Failed: ' + errorData.error);
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    async function fetchStats() {
        try {
            const res = await fetch('/api/admin/stats', {
                headers: { 'x-admin-password': sessionStorage.getItem('adminPassword') }
            });
            if (res.ok) {
                const data = await res.json();
                document.getElementById('stat-sockets').textContent = data.active_sockets;
                document.getElementById('stat-matches').textContent = data.active_matches;
                
                const uptime = Math.floor(data.server_uptime);
                const h = Math.floor(uptime / 3600);
                const m = Math.floor((uptime % 3600) / 60);
                const s = uptime % 60;
                document.getElementById('stat-uptime').textContent = `${h}h ${m}m ${s}s`;
            }
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    }

    async function fetchSolBalance() {
        try {
            const cfgRes = await fetch('/api/config');
            const cfg = await cfgRes.json();
            
            if (cfg.treasuryPublicKey && cfg.rpcUrl && window.solanaWeb3) {
                const connection = new window.solanaWeb3.Connection(cfg.rpcUrl, 'confirmed');
                const pubKey = new window.solanaWeb3.PublicKey(cfg.treasuryPublicKey);
                const balance = await connection.getBalance(pubKey);
                document.getElementById('stat-sol').textContent = (balance / window.solanaWeb3.LAMPORTS_PER_SOL).toFixed(4) + ' SOL';
            } else {
                document.getElementById('stat-sol').textContent = 'N/A';
            }
        } catch (err) {
            console.error('SOL balance fetch error:', err);
            document.getElementById('stat-sol').textContent = 'Error';
        }
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

            const statFormatted = user[statKey] 
                ? (statKey === 'online_winnings' ? parseFloat(user[statKey]).toFixed(2) + ' SOL' : user[statKey])
                : '0';

            tr.innerHTML = `
                <td><div class="rank-badge">#${index + 1}</div></td>
                <td style="font-weight: 500;">${escapeHtml(user.username || 'Unknown')}</td>
                <td>
                    ${user.wallet_address 
                        ? `<span class="wallet-address clickable-wallet" style="cursor:pointer;" title="Click to copy" data-wallet="${user.wallet_address}">${user.wallet_address}</span>` 
                        : '<span style="color:#64748b">N/A</span>'}
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

        // Add copy event listeners for the button
        const copyBtns = tbody.querySelectorAll('.copy-action-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const wallet = this.getAttribute('data-wallet');
                copyToClipboard(wallet, this);
            });
        });

        // Add click-to-copy for the wallet text itself
        const walletTexts = tbody.querySelectorAll('.clickable-wallet');
        walletTexts.forEach(span => {
            span.addEventListener('click', function() {
                const wallet = this.getAttribute('data-wallet');
                copyToClipboardText(wallet, this);
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

    function copyToClipboardText(text, spanElement) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = spanElement.textContent;
            spanElement.textContent = 'Copied!';
            spanElement.style.color = '#10b981'; // accent-green
            
            setTimeout(() => {
                spanElement.textContent = originalText;
                spanElement.style.color = ''; // reset to default CSS
            }, 1000);
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
