/**
 * SahabNote - Android App (React Native / Expo)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, Alert, SafeAreaView, StatusBar, Platform,
  KeyboardAvoidingView, ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  loadNotes, saveNotes, getDeviceId, getSettings, saveSettings,
  createNoteObject, SYNC_STATUS,
} from './utils/storage';
import { SyncClient } from './utils/sync';

const COLORS = {
  background: '#f8f9fa', surface: '#ffffff', primary: '#3b82f6',
  primaryDark: '#2563eb', text: '#1a1a1a', textSecondary: '#6b7280',
  border: '#e5e7eb', danger: '#ef4444', success: '#22c55e',
  warning: '#f97316', error: '#ef4444',
};

const DEFAULT_SERVER_URL = 'https://sahabnote.onrender.com';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authLoadingText, setAuthLoadingText] = useState('');
  const [stats, setStats] = useState({ chars: 0, words: 0, lines: 0, tokens: 0 });
  const [noteStatus, setNoteStatus] = useState({ text: 'No note selected', color: COLORS.textSecondary });

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const syncClient = useRef(new SyncClient());
  const autoSaveTimer = useRef(null);

  useEffect(() => { initApp(); }, []);

  const initApp = async () => {
    const did = await getDeviceId();
    setDeviceId(did);
    const savedNotes = await loadNotes();
    setNotes(savedNotes);
    const savedSettings = await getSettings();
    const authToken = savedSettings.auth_token || '';
    syncClient.current.setServer(DEFAULT_SERVER_URL);
    syncClient.current.setAuthToken(authToken);
    if (authToken) {
      setIsAuthenticated(true);
      checkConnection();
      try {
        await syncClient.current.pullServerChanges();
        setNotes(await loadNotes());
      } catch {}
    }
    setIsLoading(false);
  };

  const checkConnection = async () => {
    try {
      const resp = await syncClient.current.healthCheck();
      setIsOnline(resp?.status === 'ok');
    } catch { setIsOnline(false); }
  };

  const afterAuthSuccess = async (accessToken) => {
    await saveSettings({ server_url: DEFAULT_SERVER_URL, auth_token: accessToken });
    syncClient.current.setAuthToken(accessToken);
    try { await syncClient.current.pullServerChanges(); } catch {}
    setNotes(await loadNotes());
    setIsAuthenticated(true);
    setAuthLoading(false);
    checkConnection();
  };

  const doRegister = async () => {
    Keyboard.dismiss();
    if (!loginUser || !loginPass) {
      Alert.alert('Error', 'Enter a username and password');
      return;
    }
    setAuthLoading(true);
    setAuthLoadingText('Registering...');
    try {
      const client = new SyncClient(DEFAULT_SERVER_URL);
      const resp = await client.request('POST', '/api/auth/register', {
        username: loginUser, password: loginPass,
      });
      if (resp.success) {
        await afterAuthSuccess(resp.data.access_token);
      } else {
        setAuthLoading(false);
        Alert.alert('Registration Failed', resp.message || 'Please try again');
      }
    } catch (e) {
      setAuthLoading(false);
      Alert.alert('Error', e.message);
    }
  };

  const doLogin = async () => {
    Keyboard.dismiss();
    if (!loginUser || !loginPass) {
      Alert.alert('Error', 'Enter your username and password');
      return;
    }
    setAuthLoading(true);
    setAuthLoadingText('Logging in...');
    try {
      const client = new SyncClient(DEFAULT_SERVER_URL);
      const resp = await client.request('POST', '/api/auth/login', {
        username: loginUser, password: loginPass,
      });
      if (resp.success) {
        await afterAuthSuccess(resp.data.access_token);
      } else {
        setAuthLoading(false);
        Alert.alert('Login Failed', resp.message || 'Please try again');
      }
    } catch (e) {
      setAuthLoading(false);
      Alert.alert('Error', e.message);
    }
  };

  const handleLogout = async () => {
    await saveSettings({});
    setLoginUser('');
    setLoginPass('');
    setIsAuthenticated(false);
    setIsOnline(false);
    syncClient.current.setAuthToken('');
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
      ...updated[idx], title: autoTitle, content,
      updated_at: now,
      version: (updated[idx].version || 1) + 1,
      sync_status:
        updated[idx].sync_status === SYNC_STATUS.LOCAL_ONLY
          ? SYNC_STATUS.LOCAL_ONLY : SYNC_STATUS.PENDING_SYNC,
    };
    await saveNotes(updated);
    setNotes(updated);
    updateNoteStatusUI(updated[idx]);
  }, [currentNoteId, title, content, notes]);

  const handleTitleChange = (t) => { setTitle(t); scheduleAutoSave(); };
  const handleContentChange = (c) => { setContent(c); updateStats(c); scheduleAutoSave(); };

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
    setNoteStatus({
      text: 'Status: ' + (note.sync_status || 'unknown'),
      color: colors[note.sync_status] || COLORS.textSecondary,
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
      { text: 'Clear', style: 'destructive', onPress: () => {
        setTitle(''); setContent(''); updateStats(''); saveCurrentNote();
      }},
    ]);
  };

  const deleteNote = () => {
    if (!currentNoteId) return;
    const note = notes.find(n => n.client_id === currentNoteId);
    const titleStr = note?.title || 'Untitled';
    Alert.alert('Delete Note', 'Delete "' + titleStr + '"?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const now = new Date().toISOString();
        const updated = notes.map(n =>
          n.client_id === currentNoteId
            ? { ...n, deleted_at: now, sync_status: SYNC_STATUS.DELETED_PENDING }
            : n
        );
        await saveNotes(updated);
        setNotes(updated);
        setCurrentNoteId(null);
        setTitle(''); setContent(''); updateStats('');
        setNoteStatus({ text: 'Note deleted', color: COLORS.textSecondary });
      }},
    ]);
  };

  const syncNow = async () => {
    if (!isOnline) {
      Alert.alert('Sync', 'Cannot sync: offline. Changes queued.');
      return;
    }
    setIsSyncing(true);
    try {
      await syncClient.current.pushPendingChanges();
      await syncClient.current.pullServerChanges();
      const updatedNotes = await loadNotes();
      setNotes(updatedNotes);
      if (currentNoteId) {
        const n = updatedNotes.find(n => n.client_id === currentNoteId);
        if (n) updateNoteStatusUI(n);
      }
      Alert.alert('Sync', 'Sync complete!');
    } catch (e) {
      Alert.alert('Sync Error', e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderNoteItem = ({ item }) => {
    const icons = {
      [SYNC_STATUS.SYNCED]: '\u2713',
      [SYNC_STATUS.LOCAL_ONLY]: '+',
      [SYNC_STATUS.PENDING_SYNC]: '\u27F3',
      [SYNC_STATUS.CONFLICT]: '!',
    };
    const displayTitle = item.title || item.content?.slice(0, 50) || 'Untitled';
    const isActive = item.client_id === currentNoteId;
    return (
      <TouchableOpacity
        style={[styles.noteItem, isActive && styles.noteItemActive]}
        onPress={() => selectNote(item.client_id)}
      >
        <Text style={[styles.noteItemText, isActive && styles.noteItemTextActive]} numberOfLines={1}>
          {icons[item.sync_status] || '?'} {displayTitle}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>SahabNote</Text>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.loginTitle}>SahabNote</Text>
          <Text style={styles.loginSubtitle}>Sign in to sync your notes</Text>

          <TextInput style={styles.loginInput} placeholder="Username"
            placeholderTextColor={COLORS.textSecondary}
            value={loginUser} onChangeText={setLoginUser}
            autoCapitalize="none" autoCorrect={false} editable={!authLoading} />
          <TextInput style={styles.loginInput} placeholder="Password"
            placeholderTextColor={COLORS.textSecondary}
            value={loginPass} onChangeText={setLoginPass}
            secureTextEntry editable={!authLoading} />

          {authLoading && (
            <View style={styles.authLoadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.authLoadingText}>{authLoadingText}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.loginBtn, authLoading && styles.btnDisabled]}
            onPress={doLogin} disabled={authLoading}>
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.registerBtn, authLoading && styles.btnDisabled]}
            onPress={doRegister} disabled={authLoading}>
            <Text style={styles.registerBtnText}>Register</Text>
          </TouchableOpacity>

          <Text style={styles.loginServerUrl}>Server: {DEFAULT_SERVER_URL}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>SahabNote</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.statusDot, { color: isOnline ? COLORS.success : COLORS.textSecondary }]}>
            {isOnline ? '\u25CF' : '\u25CB'}
          </Text>
          <TouchableOpacity style={styles.headerBtn} onPress={syncNow}>
            <Text style={styles.headerBtnText}>{isSyncing ? '...' : '\u27F3'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleLogout}>
            <Text style={[styles.headerBtnText, { color: COLORS.danger }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput style={styles.searchInput} placeholder="Search notes..."
        placeholderTextColor={COLORS.textSecondary}
        value={search} onChangeText={setSearch} />

      <View style={styles.noteListContainer}>
        <FlatList data={getFilteredNotes()} keyExtractor={(item) => item.client_id}
          renderItem={renderNoteItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No notes yet. Create one!</Text>}
          horizontal={false} style={styles.noteList} keyboardShouldPersistTaps="handled" />
        <TouchableOpacity style={styles.newNoteBtn} onPress={createNewNote}>
          <Text style={styles.newNoteBtnText}>+ New Note</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.editorContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <TextInput style={styles.titleInput} placeholder="Note title..."
          placeholderTextColor={COLORS.textSecondary}
          value={title} onChangeText={handleTitleChange}
          editable={!!currentNoteId} />
        <TextInput style={styles.contentInput} placeholder="Start writing..."
          placeholderTextColor={COLORS.textSecondary}
          value={content} onChangeText={handleContentChange}
          multiline textAlignVertical="top" editable={!!currentNoteId} />

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={saveCurrentNote} disabled={!currentNoteId}>
            <Text style={styles.actionBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}
            onPress={copyNote} disabled={!currentNoteId}>
            <Text style={styles.actionBtnText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}
            onPress={clearNote} disabled={!currentNoteId}>
            <Text style={styles.actionBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={deleteNote} disabled={!currentNoteId}>
            <Text style={styles.actionBtnText}>Delete</Text>
          </TouchableOpacity>
          {isSyncing && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  loginContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  loginTitle: { fontSize: 32, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  loginSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32 },
  loginInput: { padding: 14, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, fontSize: 15, color: COLORS.text, marginBottom: 12 },
  authLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 8 },
  authLoadingText: { fontSize: 14, color: COLORS.primary },
  loginBtn: { padding: 14, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  registerBtn: { padding: 14, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', marginBottom: 20 },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  registerBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 16 },
  loginServerUrl: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { fontSize: 16 },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 16, color: COLORS.primary, fontWeight: '500' },
  searchInput: { margin: 12, padding: 10, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.text },
  noteListContainer: { maxHeight: 180, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  noteList: { flex: 1 },
  noteItem: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  noteItemActive: { backgroundColor: '#dbeafe' },
  noteItemText: { fontSize: 14, color: COLORS.text },
  noteItemTextActive: { color: COLORS.primaryDark, fontWeight: '600' },
  emptyText: { textAlign: 'center', padding: 20, color: COLORS.textSecondary },
  newNoteBtn: { padding: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  newNoteBtnText: { color: '#fff', fontWeight: '600' },
  editorContainer: { flex: 1, backgroundColor: COLORS.surface, margin: 12, borderRadius: 12, padding: 12 },
  titleInput: { fontSize: 18, fontWeight: '600', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8, color: COLORS.text },
  contentInput: { flex: 1, fontSize: 15, lineHeight: 22, color: COLORS.text, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  actionBtn: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  actionBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  actionBtnDanger: { borderColor: '#fca5a5' },
  actionBtnText: { fontSize: 16 },
  footer: { paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { fontSize: 11, color: COLORS.textSecondary },
  noteStatus: { fontSize: 11, marginTop: 4 },
});
