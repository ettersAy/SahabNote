/**
 * Sync client for Android/Expo app.
 */

import { loadNotes, saveNotes, SYNC_STATUS } from './storage';

const BASE_PATH = '/api/v1';

export class SyncClient {
  constructor(serverUrl = '', authToken = '') {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.authToken = authToken;
  }

  setServer(url) {
    this.serverUrl = url.replace(/\/+$/, '');
  }

  setAuthToken(token) {
    this.authToken = token;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
    };
  }

  async request(method, path, body = null) {
    if (!this.serverUrl) throw new Error('Server URL not set');
    const url = `${this.serverUrl}${path}`;

    const options = {
      method,
      headers: this.getHeaders(),
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok && !data.success) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
  }

  async healthCheck() {
    return this.request('GET', '/api/health');
  }

  async syncPush(notes) {
    return this.request('POST', `${BASE_PATH}/sync/push`, { notes });
  }

  async syncPull(since = null) {
    let path = `${BASE_PATH}/sync/pull`;
    if (since) path += `?since=${since}`;
    return this.request('GET', path);
  }

  async pushPendingChanges() {
    const notes = await loadNotes();
    const pending = notes.filter(n =>
      n.sync_status === SYNC_STATUS.LOCAL_ONLY ||
      n.sync_status === SYNC_STATUS.PENDING_SYNC ||
      n.sync_status === SYNC_STATUS.DELETED_PENDING
    );

    if (pending.length === 0) return { synced: [], conflicts: [] };

    const pushItems = pending.map(n => ({
      client_id: n.client_id,
      title: n.title || '',
      content: n.content || '',
      version: n.version || 1,
      device_id: n.device_id || '',
      deleted: n.sync_status === SYNC_STATUS.DELETED_PENDING,
    }));

    const response = await this.syncPush(pushItems);
    const result = { synced: [], conflicts: [] };

    if (response.success && response.data) {
      // Mark pushed items as synced
      for (const item of (response.data.synced || [])) {
        const idx = notes.findIndex(n => n.client_id === item.client_id);
        if (idx !== -1) {
          notes[idx].sync_status = SYNC_STATUS.SYNCED;
          notes[idx].server_id = item.server_id || notes[idx].server_id;
          if (item.version) notes[idx].version = item.version;
          result.synced.push(item);
        }
      }

      // Mark conflicts
      for (const conflict of (response.data.conflicts || [])) {
        const idx = notes.findIndex(n => n.client_id === conflict.client_id);
        if (idx !== -1) {
          notes[idx].sync_status = SYNC_STATUS.CONFLICT;
          result.conflicts.push(conflict);
        }
      }

      await saveNotes(notes);
    }

    return result;
  }

  async pullServerChanges() {
    const response = await this.syncPull();
    if (!response.success) return [];

    const serverNotes = response.data?.notes || [];
    const localNotes = await loadNotes();

    for (const serverNote of serverNotes) {
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
            sync_status: SYNC_STATUS.SYNCED,
            created_at: serverNote.created_at,
            updated_at: serverNote.updated_at,
            deleted_at: serverNote.deleted_at,
          });
        }
      } else if (
        existing.sync_status === SYNC_STATUS.SYNCED &&
        serverNote.version > existing.version
      ) {
        existing.title = serverNote.title || '';
        existing.content = serverNote.content || '';
        existing.version = serverNote.version;
        existing.updated_at = serverNote.updated_at;
        existing.deleted_at = serverNote.deleted_at;
      }
    }

    await saveNotes(localNotes);
    return serverNotes;
  }
}
