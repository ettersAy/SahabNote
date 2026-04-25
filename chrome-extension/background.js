/**
 * SahabNote Background Service Worker
 * Handles periodic sync and message passing.
 */

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  const { device_id } = await chrome.storage.local.get('device_id');
  if (!device_id) {
    await chrome.storage.local.set({ device_id: generateId() });
  }
  await chrome.storage.local.set({ last_sync: null });

  // Start periodic sync
  setupPeriodicSync();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SYNC_NOW':
      handleSync().then(sendResponse);
      return true;
    case 'GET_STATUS':
      getStatus().then(sendResponse);
      return true;
  }
});

function setupPeriodicSync() {
  chrome.alarms.create('syncNotes', { periodInMinutes: 5 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncNotes') {
    handleSync();
  }
});

async function handleSync() {
  try {
    const { server_url, auth_token } = await chrome.storage.local.get([
      'server_url', 'auth_token'
    ]);

    if (!server_url || !auth_token) {
      console.log('Sync skipped: not configured');
      return { success: false, message: 'Not configured' };
    }

    const baseUrl = server_url.replace(/\/+$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth_token}`
    };

    // 1. Push pending changes
    const { notes } = await chrome.storage.local.get('notes');
    const localNotes = notes || [];
    const pendingNotes = localNotes.filter(n =>
      n.sync_status === 'local_only' ||
      n.sync_status === 'pending_sync' ||
      n.sync_status === 'deleted_pending_sync'
    );

    if (pendingNotes.length > 0) {
      const pushItems = pendingNotes.map(n => ({
        client_id: n.client_id,
        title: n.title || '',
        content: n.content || '',
        version: n.version || 1,
        device_id: n.device_id || '',
        deleted: n.sync_status === 'deleted_pending_sync'
      }));

      const pushResp = await fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ notes: pushItems })
      });
      const pushData = await pushResp.json();

      if (pushData.success) {
        for (const item of pushData.data.synced) {
          const idx = localNotes.findIndex(n => n.client_id === item.client_id);
          if (idx !== -1) {
            localNotes[idx].sync_status = 'synced';
            localNotes[idx].server_id = item.server_id;
            if (item.version) localNotes[idx].version = item.version;
          }
        }
        // Handle conflicts
        for (const conflict of (pushData.data.conflicts || [])) {
          const idx = localNotes.findIndex(n => n.client_id === conflict.client_id);
          if (idx !== -1) {
            localNotes[idx].sync_status = 'sync_conflict';
          }
        }
      }
    }

    // 2. Pull server changes
    const pullResp = await fetch(`${baseUrl}/api/v1/sync/pull`, {
      method: 'GET',
      headers
    });
    const pullData = await pullResp.json();

    if (pullData.success && pullData.data.notes) {
      for (const serverNote of pullData.data.notes) {
        const existing = localNotes.find(n => n.client_id === serverNote.client_id);
        if (!existing) {
          if (!serverNote.deleted_at) {
            localNotes.push({
              id: serverNote.client_id,
              server_id: serverNote.id,
              client_id: serverNote.client_id,
              title: serverNote.title || '',
              content: serverNote.content || '',
              version: serverNote.version || 1,
              device_id: serverNote.device_id || '',
              sync_status: 'synced',
              created_at: serverNote.created_at,
              updated_at: serverNote.updated_at,
              deleted_at: serverNote.deleted_at
            });
          }
        } else if (existing.sync_status === 'synced' && serverNote.version > existing.version) {
          existing.title = serverNote.title || '';
          existing.content = serverNote.content || '';
          existing.version = serverNote.version;
          existing.updated_at = serverNote.updated_at;
          existing.deleted_at = serverNote.deleted_at;
        }
      }
    }

    await chrome.storage.local.set({
      notes: localNotes,
      last_sync: new Date().toISOString()
    });

    return { success: true, message: 'Sync complete' };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, message: error.message };
  }
}

async function getStatus() {
  const { server_url, auth_token, last_sync } = await chrome.storage.local.get([
    'server_url', 'auth_token', 'last_sync'
  ]);
  const online = !!(server_url && auth_token);

  return {
    online,
    last_sync,
    configured: !!auth_token
  };
}

function generateId() {
  return 'sn_' + crypto.randomUUID();
}
