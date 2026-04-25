/**
 * SahabNote Chrome Extension Popup
 */

let currentNoteId = null;
let allNotes = [];
let autoSaveTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadNotes();
  await checkConfig();
  updateStatus();

  // Load last selected note
  const { selected_note_id } = await chrome.storage.local.get('selected_note_id');
  if (selected_note_id) {
    loadNote(selected_note_id);
  }

  // Event listeners
  document.getElementById('new-btn').addEventListener('click', createNewNote);
  document.getElementById('save-btn').addEventListener('click', saveCurrentNote);
  document.getElementById('copy-btn').addEventListener('click', copyNote);
  document.getElementById('clear-btn').addEventListener('click', clearNote);
  document.getElementById('delete-btn').addEventListener('click', deleteCurrentNote);
  document.getElementById('sync-btn').addEventListener('click', syncNow);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('go-settings-btn').addEventListener('click', openSettings);
  document.getElementById('search-input').addEventListener('input', filterNotes);

  document.getElementById('note-title').addEventListener('input', onEditorChange);
  document.getElementById('note-content').addEventListener('input', onEditorChange);
});

async function checkConfig() {
  const { server_url, auth_token } = await chrome.storage.local.get(['server_url', 'auth_token']);
  const setupNotice = document.getElementById('setup-notice');
  if (!server_url || !auth_token) {
    setupNotice.classList.remove('hidden');
  } else {
    setupNotice.classList.add('hidden');
  }
}

async function loadNotes() {
  const { notes } = await chrome.storage.local.get('notes');
  allNotes = notes || [];
  renderNoteList();
}

function renderNoteList() {
  const list = document.getElementById('note-list');
  const search = document.getElementById('search-input').value.toLowerCase();

  const filtered = allNotes.filter(n => {
    if (n.deleted_at) return false;
    if (search) {
      return (n.title || '').toLowerCase().includes(search) ||
             (n.content || '').toLowerCase().includes(search);
    }
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No notes found</div>';
    return;
  }

  list.innerHTML = filtered.map(n => {
    const title = n.title || n.content?.slice(0, 50) || 'Untitled';
    const icon = { synced: '✓', local_only: '+', pending_sync: '⟳', sync_conflict: '!' }[n.sync_status] || '?';
    const isActive = n.client_id === currentNoteId ? 'active' : '';
    return `<div class="note-list-item ${isActive}" data-id="${n.client_id}">${icon} ${escapeHtml(title)}</div>`;
  }).join('');

  // Add click handlers
  list.querySelectorAll('.note-list-item').forEach(el => {
    el.addEventListener('click', () => loadNote(el.dataset.id));
  });
}

function loadNote(noteId) {
  const note = allNotes.find(n => n.client_id === noteId);
  if (!note) return;

  currentNoteId = noteId;
  document.getElementById('note-title').value = note.title || '';
  document.getElementById('note-content').value = note.content || '';
  document.getElementById('save-btn').disabled = true;
  document.getElementById('copy-btn').disabled = false;
  document.getElementById('clear-btn').disabled = false;
  document.getElementById('delete-btn').disabled = false;

  updateNoteStatus(note);
  updateStats();
  renderNoteList();

  chrome.storage.local.set({ selected_note_id: noteId });
}

function createNewNote() {
  const id = generateId();
  const now = new Date().toISOString();
  const note = {
    id,
    client_id: id,
    title: '',
    content: '',
    version: 1,
    device_id: '',
    sync_status: 'local_only',
    created_at: now,
    updated_at: now,
    deleted_at: null
  };

  // Get device_id
  chrome.storage.local.get('device_id', (result) => {
    note.device_id = result.device_id || '';
    allNotes.unshift(note);
    chrome.storage.local.set({ notes: allNotes }, () => {
      loadNote(id);
    });
  });
}

function saveCurrentNote() {
  if (!currentNoteId) return;

  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value;
  const now = new Date().toISOString();

  const idx = allNotes.findIndex(n => n.client_id === currentNoteId);
  if (idx === -1) return;

  const autoTitle = title || content.split('\n')[0]?.slice(0, 80) || 'Untitled';
  allNotes[idx].title = autoTitle;
  allNotes[idx].content = content;
  allNotes[idx].updated_at = now;
  allNotes[idx].version = (allNotes[idx].version || 1) + 1;
  if (allNotes[idx].sync_status !== 'sync_conflict') {
    allNotes[idx].sync_status = allNotes[idx].sync_status === 'local_only' ? 'local_only' : 'pending_sync';
  }

  chrome.storage.local.set({ notes: allNotes }, () => {
    document.getElementById('save-btn').disabled = true;
    document.getElementById('last-saved').textContent = `Saved: ${now.slice(0, 19)}`;
    loadNotes();
    updateNoteStatus(allNotes[idx]);
  });
}

function copyNote() {
  const content = document.getElementById('note-content').value;
  navigator.clipboard.writeText(content).then(() => {
    document.getElementById('status-text').textContent = 'Copied!';
    setTimeout(() => updateNoteStatus(allNotes.find(n => n.client_id === currentNoteId)), 2000);
  });
}

function clearNote() {
  if (!currentNoteId || !confirm('Clear all content?')) return;
  document.getElementById('note-title').value = '';
  document.getElementById('note-content').value = '';
  updateStats();
  saveCurrentNote();
}

function deleteCurrentNote() {
  if (!currentNoteId) return;
  const note = allNotes.find(n => n.client_id === currentNoteId);
  const title = note?.title || 'Untitled';
  if (!confirm(`Delete "${title}"?`)) return;

  const idx = allNotes.findIndex(n => n.client_id === currentNoteId);
  if (idx === -1) return;

  allNotes[idx].deleted_at = new Date().toISOString();
  allNotes[idx].sync_status = 'deleted_pending_sync';

  chrome.storage.local.set({ notes: allNotes }, () => {
    currentNoteId = null;
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('save-btn').disabled = true;
    document.getElementById('copy-btn').disabled = true;
    document.getElementById('clear-btn').disabled = true;
    document.getElementById('delete-btn').disabled = true;
    document.getElementById('status-text').textContent = 'Note deleted';
    document.getElementById('last-saved').textContent = '';
    updateStats();
    loadNotes();
  });
}

function onEditorChange() {
  if (currentNoteId) {
    document.getElementById('save-btn').disabled = false;
    updateStats();

    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveCurrentNote, 2000);
  }
}

function updateStats() {
  const content = document.getElementById('note-content').value;
  const chars = content.length;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lines = content ? content.split('\n').length : 0;
  const tokens = Math.max(1, Math.floor(chars / 4));

  document.getElementById('char-count').textContent = `Chars: ${chars}`;
  document.getElementById('word-count').textContent = `Words: ${words}`;
  document.getElementById('line-count').textContent = `Lines: ${lines}`;
  document.getElementById('token-count').textContent = `Tokens: ~${tokens}`;
}

function updateNoteStatus(note) {
  if (!note) {
    document.getElementById('status-text').textContent = 'No note selected';
    return;
  }
  const status = note.sync_status || 'unknown';
  const colors = {
    synced: '#22c55e',
    local_only: '#f97316',
    pending_sync: '#3b82f6',
    sync_conflict: '#ef4444',
    deleted_pending_sync: '#9ca3af'
  };
  document.getElementById('status-text').innerHTML =
    `Status: <span style="color:${colors[status] || '#666'}">${status}</span>`;
  document.getElementById('last-saved').textContent =
    note.updated_at ? `Updated: ${note.updated_at.slice(0, 19)}` : '';
}

function filterNotes() {
  renderNoteList();
}

function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
    if (status) {
      const indicator = document.getElementById('online-indicator');
      indicator.textContent = status.online ? '●' : '○';
      indicator.className = status.online ? 'online' : 'offline';
      document.getElementById('sync-status').textContent =
        status.last_sync ? `Last sync: ${status.last_sync.slice(0, 19)}` : 'No sync yet';
    }
  });
}

function syncNow() {
  document.getElementById('sync-status').textContent = 'Syncing...';
  document.getElementById('status-text').textContent = 'Syncing...';

  chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, async (response) => {
    if (response?.success) {
      await loadNotes();
      if (currentNoteId) {
        const note = allNotes.find(n => n.client_id === currentNoteId);
        if (note) loadNote(currentNoteId);
      }
    }
    updateStatus();
    document.getElementById('status-text').textContent =
      response?.success ? 'Sync complete!' : `Sync failed: ${response?.message || 'error'}`;
    setTimeout(() => {
      const note = allNotes.find(n => n.client_id === currentNoteId);
      updateNoteStatus(note);
    }, 3000);
  });
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function generateId() {
  return 'sn_' + crypto.randomUUID();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
