/**
 * Sync state management hook.
 *
 * Manages: SyncClient ref, isOnline, isSyncing, syncNow, checkConnection.
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { loadNotes } from '../utils/storage';

export default function useSync(syncClientRef) {
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkConnection = async () => {
    try {
      const resp = await syncClientRef.current.healthCheck();
      setIsOnline(resp?.status === 'ok');
    } catch {
      setIsOnline(false);
    }
  };

  const syncNow = async (saveBeforeSync) => {
    if (!isOnline) {
      Alert.alert('Sync', 'Cannot sync: offline. Changes queued.');
      return;
    }
    if (saveBeforeSync) await saveBeforeSync();
    setIsSyncing(true);
    try {
      await syncClientRef.current.pushPendingChanges();
      await syncClientRef.current.pullServerChanges();
      const updatedNotes = await loadNotes();
      Alert.alert('Sync', 'Sync complete!');
      return updatedNotes;
    } catch (e) {
      Alert.alert('Sync Error', e.message);
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncClient: syncClientRef,
    isOnline, setIsOnline,
    isSyncing, setIsSyncing,
    checkConnection,
    syncNow,
  };
}
