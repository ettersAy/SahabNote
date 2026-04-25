/**
 * SahabNote Chrome Extension Settings
 */

document.addEventListener('DOMContentLoaded', async () => {
  const { server_url, auth_token, device_id } = await chrome.storage.local.get([
    'server_url', 'auth_token', 'device_id'
  ]);

  if (server_url) document.getElementById('server-url').value = server_url;
  if (auth_token) document.getElementById('auth-token').value = auth_token;
  document.getElementById('device-info').textContent =
    `Device ID: ${device_id || 'Not set - will generate on first use'}`;
});

function toggleTokenVisibility() {
  const input = document.getElementById('auth-token');
  input.type = document.getElementById('show-token').checked ? 'text' : 'password';
}

async function saveSettings() {
  const server_url = document.getElementById('server-url').value.trim();
  const auth_token = document.getElementById('auth-token').value.trim();

  await chrome.storage.local.set({ server_url, auth_token });

  showStatus('connection-status', 'Settings saved!', 'success');
}

async function testConnection() {
  const server_url = document.getElementById('server-url').value.trim();
  if (!server_url) {
    showStatus('connection-status', 'Please enter a server URL', 'error');
    return;
  }

  try {
    const resp = await fetch(`${server_url.replace(/\/+$/, '')}/api/health`);
    const data = await resp.json();
    if (data.status === 'ok') {
      showStatus('connection-status', 'Connection successful! Server is running.', 'success');
    } else {
      showStatus('connection-status', 'Unexpected response from server.', 'error');
    }
  } catch (e) {
    showStatus('connection-status', `Connection failed: ${e.message}`, 'error');
  }
}

async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const server_url = document.getElementById('server-url').value.trim();

  if (!username || !password) {
    showStatus('account-status', 'Please fill in both fields', 'error');
    return;
  }
  if (!server_url) {
    showStatus('account-status', 'Please enter server URL first', 'error');
    return;
  }

  try {
    const resp = await fetch(`${server_url.replace(/\/+$/, '')}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();
    if (data.success) {
      document.getElementById('auth-token').value = data.data.access_token;
      await chrome.storage.local.set({
        auth_token: data.data.access_token,
        server_url: server_url
      });
      showStatus('account-status',
        `Registered! Sync key: ${data.data.sync_key.slice(0, 20)}... (saved to clipboard)`,
        'success');
      navigator.clipboard.writeText(data.data.sync_key);
    } else {
      showStatus('account-status', `Failed: ${data.message}`, 'error');
    }
  } catch (e) {
    showStatus('account-status', `Error: ${e.message}`, 'error');
  }
}

async function doLogin() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const server_url = document.getElementById('server-url').value.trim();

  if (!username || !password) {
    showStatus('account-status', 'Please fill in both fields', 'error');
    return;
  }
  if (!server_url) {
    showStatus('account-status', 'Please enter server URL first', 'error');
    return;
  }

  try {
    const resp = await fetch(`${server_url.replace(/\/+$/, '')}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();
    if (data.success) {
      document.getElementById('auth-token').value = data.data.access_token;
      await chrome.storage.local.set({
        auth_token: data.data.access_token,
        server_url: server_url
      });
      showStatus('account-status',
        `Login successful! Sync key: ${data.data.sync_key.slice(0, 20)}...`,
        'success');
      navigator.clipboard.writeText(data.data.sync_key);
    } else {
      showStatus('account-status', `Failed: ${data.message}`, 'error');
    }
  } catch (e) {
    showStatus('account-status', `Error: ${e.message}`, 'error');
  }
}

function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `status ${type}`;
  el.classList.remove('hidden');
}
