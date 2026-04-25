/**
 * Local storage for the Android/Expo app.
 * Uses AsyncStorage for persisting notes and settings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  NOTES: '@sahabnote/notes',
  SETTINGS: '@sahabnote/settings',
  DEVICE_ID: '@sahabnote/device_id',
};

// Sync status constants
export const SYNC_STATUS = {
  SYNCED: 'synced',
  LOCAL_ONLY: 'local_only',
  PENDING_SYNC: 'pending_sync',
  CONFLICT: 'sync_conflict',
  DELETED_PENDING: 'deleted_pending_sync',
};

export async function getDeviceId() {
  try {
    let deviceId = await AsyncStorage.getItem(KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = 'sn_' + generateUUID();
      await AsyncStorage.setItem(KEYS.DEVICE_ID, deviceId);
    }
    return deviceId;
  } catch {
    return 'sn_' + generateUUID();
  }
}

export async function getSettings() {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadNotes() {
  try {
    const data = await AsyncStorage.getItem(KEYS.NOTES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveNotes(notes) {
  await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
}

export function createNoteObject(clientId, title = '', content = '', deviceId = '') {
  const now = new Date().toISOString();
  return {
    id: clientId,
    server_id: null,
    client_id: clientId,
    title,
    content,
    version: 1,
    device_id: deviceId,
    sync_status: SYNC_STATUS.LOCAL_ONLY,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
