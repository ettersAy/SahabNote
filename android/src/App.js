/**
 * SahabNote - Android App (React Native / Expo)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  loadNotes,
  saveNotes,
  getDeviceId,
  getSettings,
  saveSettings,
  createNoteObject,
  SYNC_STATUS,
} from './utils/storage';
import { SyncClient } from './utils/sync';

const COLORS = {
  background: '#f8f9fa',
  surface: '#ffffff',
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f97316',
  error: '#ef4444',
};

export default function App() {
  const [notes, setNotes] = useState([]);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [settings, setSettingsData] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState({ chars: 0, words: 0, lines: 0, tokens: 0 });
  const [noteStatus, setNoteStatus] = useState({ text: 'No note selected', color: COLORS.textSecondary });
  const [setupUrl, setSetupUrl] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [syncKey, setSyncKey] = useState('');
  const [registerUser, setRegisterUser] = useState('');
  const [registerPass, setRegisterPass] = useState('');

  const syncClient = useRef(new SyncClient());
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    const did = await getDeviceId();
    setDeviceId(did);

    const savedNotes = await loadNotes();
    setNotes(savedNotes);

    const savedSettings = await getSettings();
    setSettingsData(savedSettings);
    setSetupUrl(savedSettings.server_url || 'http://localhost:8000');
    setSetupToken(savedSettings.auth_token || '');

    syncClient.current.setServer(savedSettings.server_url || '');
    syncClient.current.setAuthToken(savedSettings.auth_token || '');

    checkConnection();
  };

  const checkConnection = async () => {
    try {
      const resp = await syncClient.current.healthCheck();
      setIsOnline(resp?.status === 'ok');
    } catch {
      setIsOnline(false);
    }
  };

  const currentNote = notes.find(n => n.client_id === currentNoteId);

  const getFilteredNotes = () => {
    const q = search.toLowerCase();
    if (!q) return notes.filter(n => !n.deleted_at);
    return notes.filter(n =>
      !n.deleted_at && (
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      )
    );
  };

  const createNewNote = async () => {
    const id = 'sn_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const note = createNoteObject(id, '', '', deviceId);
    const updated = [note, ...notes];
    await saveNotes(updated);
    setNotes(updated);
    selectNote(id);
  };

  const selectNote = (noteId) => {
    // Save current
    if (currentNoteId) saveCurrentNote();

    const note = notes.find(n => n.client_id === noteId);
    if (!note) return;
    setCurrentNoteId(noteId);
    setTitle(note.title || '');
    setContent(note.content || '');
    updateStats(note.content || '');
    updateNoteStatusUI(note);
  };

  const saveCurrentNote = useCallback(async () => {
    if (!currentNoteId) return;
    const idx = notes.findIndex(n => n.client_id === currentNoteId);
    if (idx === -1) return;

    const autoTitle = title || (content ? content.split('\n')[0].slice(0, 80) : '') || 'Untitled';
    const now = new Date().toISOString();
    const updated = [...notes];
    updated[idx] = {
      ...updated[idx],
      title: autoTitle,
      content,
      updated_at: now,
      version: (updated[idx].version || 1) + 1,
      sync_status:
        updated[idx].sync_status === SYNC_STATUS.LOCAL_ONLY
          ? SYNC_STATUS.LOCAL_ONLY
          : SYNC_STATUS.PENDING_SYNC,
    };
    await saveNotes(updated);
    setNotes(updated);
    updateNoteStatusUI(updated[idx]);
  }, [currentNoteId, title, content, notes]);

  const handleTitleChange = (t) => {
    setTitle(t);
    scheduleAutoSave();
  };

  const handleContentChange = (c) => {
    setContent(c);
    updateStats(c);
    scheduleAutoSave();
  };

  const scheduleAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveCurrentNote, 2000);
  };

  const updateStats = (text) => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;
    const tokens = Math.max(1, Math.floor(chars / 4));
    setStats({ chars, words, lines, tokens });
  };

  const updateNoteStatusUI = (note) => {
    if (!note) {
      setNoteStatus({ text: 'No note selected', color: COLORS.textSecondary });
      return;
    }
    const colors = {
      [SYNC_STATUS.SYNCED]: COLORS.success,
      [SYNC_STATUS.LOCAL_ONLY]: COLORS.warning,
      [SYNC_STATUS.PENDING_SYNC]: COLORS.primary,
      [SYNC_STATUS.CONFLICT]: COLORS.error,
      [SYNC_STATUS.DELETED_PENDING]: COLORS.textSecondary,
    };
    const statusLabel = note.sync_status || 'unknown';
    setNoteStatus({
      text: `Status: ${statusLabel}`,
      color: colors[statusLabel] || COLORS.textSecondary,
    });
  };

  const copyNote = async () => {
    await Clipboard.setStringAsync(content);
    Alert.alert('Copied', 'Note content copied to clipboard');
  };

  const clearNote = () => {
    if (!currentNoteId) return;
    Alert.alert('Clear Note', 'Clear all content?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setTitle('');
          setContent('');
          updateStats('');
          saveCurrentNote();
        },
      },
    ]);
  };

  const deleteNote = () => {
    if (!currentNoteId) return;
    const note = notes.find(n => n.client_id === currentNoteId);
    const noteTitle = note?.title || 'Untitled';
    Alert.alert('Delete Note', `Delete "${noteTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const now = new Date().toISOString();
          const updated = notes.map(n =>
            n.client_id === currentNoteId
              ? { ...n, deleted_at: now, sync_status: SYNC_STATUS.DELETED_PENDING }
              : n
          );
          await saveNotes(updated);
          setNotes(updated);
          setCurrentNoteId(null);
          setTitle('');
          setContent('');
          updateStats('');
          setNoteStatus({ text: 'Note deleted', color: COLORS.textSecondary });
        },
      },
    ]);
  };

  const syncNow = async () => {
    if (!settingsData.server_url || !settingsData.auth_token) {
      Alert.alert('Sync', 'Please configure server settings first.');
      return;
    }
    if (!isOnline) {
      Alert.alert('Sync', 'Cannot sync: offline. Changes queued.');
      return;
    }

    setIsSyncing(true);
    try {
      // Push
      await syncClient.current.pushPendingChanges();
      // Pull
      await syncClient.current.pullServerChanges();

      const updatedNotes = await loadNotes();
      setNotes(updatedNotes);
      if (currentNoteId) {
        const note = updatedNotes.find(n => n.client_id === currentNoteId);
        if (note) updateNoteStatusUI(note);
      }
      Alert.alert('Sync', 'Sync complete!');
    } catch (e) {
      Alert.alert('Sync Error', e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSettingsHandler = async () => {
    const newSettings = { server_url: setupUrl, auth_token: setupToken };
    await saveSettings(newSettings);
    setSettingsData(newSettings);
    syncClient.current.setServer(setupUrl);
    syncClient.current.setAuthToken(setupToken);
    setShowSettings(false);
    checkConnection();
  };

  const doRegister = async () => {
    if (!registerUser || !registerPass) {
      Alert.alert('Error', 'Fill username and password');
      return;
    }
    try {
      const client = new SyncClient(setupUrl);
      const resp = await client.request('POST', '/api/auth/register', {
        username: registerUser,
        password: registerPass,
      });
      if (resp.success) {
        setSetupToken(resp.data.access_token);
        setSyncKey(resp.data.sync_key);
        Alert.alert('Registered!', `Sync key: ${resp.data.sync_key.slice(0, 20)}...\nSaved to settings.`);
        await saveSettings({ server_url: setupUrl, auth_token: resp.data.access_token });
        setSettingsData({ server_url: setupUrl, auth_token: resp.data.access_token });
        syncClient.current.setServer(setupUrl);
        syncClient.current.setAuthToken(resp.data.access_token);
      } else {
        Alert.alert('Error', resp.message || 'Registration failed');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const doLogin = async () => {
    if (!registerUser || !registerPass) {
      Alert.alert('Error', 'Fill username and password');
      return;
    }
    try {
      const client = new SyncClient(setupUrl);
      const resp = await client.request('POST', '/api/auth/login', {
        username: registerUser,
        password: registerPass,
      });
      if (resp.success) {
        setSetupToken(resp.data.access_token);
        Alert.alert('Logged in!', `Sync key: ${resp.data.sync_key.slice(0, 20)}...`);
        await saveSettings({ server_url: setupUrl, auth_token: resp.data.access_token });
        setSettingsData({ server_url: setupUrl, auth_token: resp.data.access_token });
        syncClient.current.setServer(setupUrl);
        syncClient.current.setAuthToken(resp.data.access_token);
      } else {
        Alert.alert('Error', resp.message || 'Login failed');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const renderNoteItem = ({ item }) => {
    const icons = {
      [SYNC_STATUS.SYNCED]: '✓',
      [SYNC_STATUS.LOCAL_ONLY]: '+',
      [SYNC_STATUS.PENDING_SYNC]: '⟳',
      [SYNC_STATUS.CONFLICT]: '!',
    };
    const icon = icons[item.sync_status] || '?';
    const displayTitle = item.title || item.content?.slice(0, 50) || 'Untitled';
    const isActive = item.client_id === currentNoteId;
    return (
      <TouchableOpacity
        style={[styles.noteItem, isActive && styles.noteItemActive]}
        onPress={() => selectNote(item.client_id)}
      >
        <Text style={[styles.noteItemText, isActive && styles.noteItemTextActive]} numberOfLines={1}>
          {icon} {displayTitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SahabNote</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.statusDot, { color: isOnline ? COLORS.success : COLORS.textSecondary }]}>
            {isOnline ? '●' : '○'}
          </Text>
          <TouchableOpacity style={styles.headerBtn} onPress={syncNow}>
            <Text style={styles.headerBtnText}>⟳</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
            <Text style={styles.headerBtnText}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search notes..."
        placeholderTextColor={COLORS.textSecondary}
        value={search}
        onChangeText={setSearch}
      />

      {/* Note List */}
      <View style={styles.noteListContainer}>
        <FlatList
          data={getFilteredNotes()}
          keyExtractor={(item) => item.client_id}
          renderItem={renderNoteItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notes yet. Create one!</Text>
          }
          horizontal={false}
          style={styles.noteList}
          keyboardShouldPersistTaps="handled"
        />
        <TouchableOpacity style={styles.newNoteBtn} onPress={createNewNote}>
          <Text style={styles.newNoteBtnText}>+ New Note</Text>
        </TouchableOpacity>
      </View>

      {/* Editor */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.editorContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TextInput
          style={styles.titleInput}
          placeholder="Note title..."
          placeholderTextColor={COLORS.textSecondary}
          value={title}
          onChangeText={handleTitleChange}
          editable={!!currentNoteId}
        />
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor={COLORS.textSecondary}
          value={content}
          onChangeText={handleContentChange}
          multiline
          textAlignVertical="top"
          editable={!!currentNoteId}
        />

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={saveCurrentNote}
            disabled={!currentNoteId}
          >
            <Text style={styles.actionBtnText}>💾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={copyNote}
            disabled={!currentNoteId}
          >
            <Text style={styles.actionBtnText}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={clearNote}
            disabled={!currentNoteId}
          >
            <Text style={styles.actionBtnText}>🗑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={deleteNote}
            disabled={!currentNoteId}
          >
            <Text style={styles.actionBtnText}>✕</Text>
          </TouchableOpacity>
          {isSyncing && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

        {/* Footer Stats */}
        <View style={styles.footer}>
          <View style={styles.stats}>
            <Text style={styles.statText}>Chars: {stats.chars}</Text>
            <Text style={styles.statText}>Words: {stats.words}</Text>
            <Text style={styles.statText}>Lines: {stats.lines}</Text>
            <Text style={styles.statText}>Tokens: ~{stats.tokens}</Text>
          </View>
          <Text style={[styles.noteStatus, { color: noteStatus.color }]}>{noteStatus.text}</Text>
        </View>
      </KeyboardAvoidingView>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>

            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              value={setupUrl}
              onChangeText={setSetupUrl}
              placeholder="http://localhost:8000"
              placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.label}>Auth Token / Sync Key</Text>
            <TextInput
              style={styles.input}
              value={setupToken}
              onChangeText={setSetupToken}
              placeholder="Your auth token"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
            />

            <Text style={styles.infoText}>Device ID: {deviceId?.slice(0, 20)}...</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveSettingsHandler}>
                <Text style={styles.primaryBtnText}>Save Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowSettings(false)}>
                <Text style={styles.secondaryBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Account Setup</Text>
            <TextInput
              style={styles.input}
              value={registerUser}
              onChangeText={setRegisterUser}
              placeholder="Username"
              placeholderTextColor={COLORS.textSecondary}
            />
            <TextInput
              style={styles.input}
              value={registerPass}
              onChangeText={setRegisterPass}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={doRegister}>
                <Text style={styles.primaryBtnText}>Register</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={doLogin}>
                <Text style={styles.secondaryBtnText}>Login</Text>
              </TouchableOpacity>
            </View>

            {syncKey ? (
              <Text style={styles.infoText}>Sync key: {syncKey.slice(0, 30)}...</Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    fontSize: 16,
  },
  headerBtn: {
    padding: 6,
  },
  headerBtnText: {
    fontSize: 18,
  },
  searchInput: {
    margin: 12,
    padding: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.text,
  },
  noteListContainer: {
    maxHeight: 180,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  noteList: {
    flex: 1,
  },
  noteItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  noteItemActive: {
    backgroundColor: '#dbeafe',
  },
  noteItemText: {
    fontSize: 14,
    color: COLORS.text,
  },
  noteItemTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: COLORS.textSecondary,
  },
  newNoteBtn: {
    padding: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  newNoteBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  editorContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    margin: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
    color: COLORS.text,
  },
  contentInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionBtnDanger: {
    borderColor: '#fca5a5',
  },
  actionBtnText: {
    fontSize: 16,
  },
  footer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  noteStatus: {
    fontSize: 11,
    marginTop: 4,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    color: COLORS.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
});
