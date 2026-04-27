/**
 * SahabNote - Android App (React Native / Expo)
 *
 * Two-screen design after login:
 *   - Note List Screen: list of notes with a floating "+" button at bottom-right
 *   - Note Editor Screen: full-screen editor with back button, auto-save on changes
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
  // --- Navigation ---
  const [screen, setScreen] = useState('list'); // 'list' or 'editor'

  // --- Note data ---
  const [notes, setNotes] = useState([]);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [deviceId, setDeviceId] = useState('');

  // --- App state ---
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authLoadingText, setAuthLoadingText] = useState('');
  const [stats, setStats] = useState({ chars: 0, words: 0, lines: 0, tokens: 0 });
  const [noteStatus, setNoteStatus] = useState({ text: '', color: COLORS.textSecondary });
  const [isSaving, setIsSaving] = useState(false);

  // --- Auth ---
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
    await saveCurrentNoteImmediate();
    await saveSettings({});
    setLoginUser('');
    setLoginPass('');
    setIsAuthenticated(false);
    setIsOnline(false);
    syncClient.current.setAuthToken('');
    setScreen('list');
    setCurrentNoteId(null);
    setTitle('');
    setContent('');
  };

  // ===================== NOTE ACTIONS =====================

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
    setCurrentNoteId(id);
    setTitle('');
    setContent('');
    setStats({ chars: 0, words: 0, lines: 0, tokens: 0 });
    setNoteStatus({ text: 'New note', color: COLORS.textSecondary });
    setScreen('editor');
  };

  const openNote = (noteId) => {
    saveCurrentNoteImmediate();
    const note = notes.find(n => n.client_id === noteId);
    if (!note) return;
    setCurrentNoteId(noteId);
    setTitle(note.title || '');
    setContent(note.content || '');
    updateStats(note.content || '');
    updateNoteStatusUI(note);
    setScreen('editor');
  };

  const goBackToList = () => {
    saveCurrentNoteImmediate();
    setScreen('list');
    setCurrentNoteId(null);
    setTitle('');
    setContent('');
    setStats({ chars: 0, words: 0, lines: 0, tokens: 0 });
    setNoteStatus({ text: '', color: COLORS.textSecondary });
  };

  // ===================== AUTO-SAVE =====================

  const saveCurrentNoteImmediate = useCallback(async () => {
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
    setIsSaving(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveCurrentNoteImmediate().then(() => setIsSaving(false));
    }, 1500);
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
      setNoteStatus({ text: '', color: COLORS.textSecondary });
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
      text: note.sync_status || 'unknown',
      color: colors[note.sync_status] || COLORS.textSecondary,
    });
  };

  // ===================== NOTE TOOLS =====================

  const copyNote = async () => {
    await Clipboard.setStringAsync(content);
    Alert.alert('Copied', 'Note content copied to clipboard');
  };

  const clearNote = () => {
    if (!currentNoteId) return;
    Alert.alert('Clear Note', 'Clear all content?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        setTitle(''); setContent(''); updateStats('');
        const idx = notes.findIndex(n => n.client_id === currentNoteId);
        if (idx !== -1) {
          const now = new Date().toISOString();
          const updated = [...notes];
          updated[idx] = {
            ...updated[idx], title: '', content: '',
            updated_at: now,
            version: (updated[idx].version || 1) + 1,
            sync_status: SYNC_STATUS.PENDING_SYNC,
          };
          saveNotes(updated).then(() => setNotes(updated));
        }
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
        goBackToList();
      }},
    ]);
  };

  const syncNow = async () => {
    if (!isOnline) {
      Alert.alert('Sync', 'Cannot sync: offline. Changes queued.');
      return;
    }
    if (currentNoteId) await saveCurrentNoteImmediate();
    setIsSyncing(true);
    try {
      await syncClient.current.pushPendingChanges();
      await syncClient.current.pullServerChanges();
      const updatedNotes = await loadNotes();
      setNotes(updatedNotes);
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
    const preview = item.content ? item.content.slice(0, 80).replace(/\n/g, ' ') : '';
    const dateStr = item.updated_at
      ? new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <TouchableOpacity
        style={styles.noteItem}
        onPress={() => openNote(item.client_id)}
        activeOpacity={0.7}
      >
        <View style={styles.noteItemRow}>
          <Text style={styles.noteItemIcon}>{icons[item.sync_status] || '?'}</Text>
          <View style={styles.noteItemContent}>
            <Text style={styles.noteItemTitle} numberOfLines={1}>{displayTitle}</Text>
            {preview ? (
              <Text style={styles.noteItemPreview} numberOfLines={1}>{preview}</Text>
            ) : null}
          </View>
          <Text style={styles.noteItemDate}>{dateStr}</Text>
        </View>
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

  // ===================== NOTE LIST SCREEN =====================

  if (screen === 'list') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

        {/* Header */}
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

        {/* Search */}
        <TextInput style={styles.searchInput} placeholder="Search notes..."
          placeholderTextColor={COLORS.textSecondary}
          value={search} onChangeText={setSearch} />

        {/* Note list */}
        <FlatList
          data={getFilteredNotes()}
          keyExtractor={(item) => item.client_id}
          renderItem={renderNoteItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No notes yet</Text>
              <Text style={styles.emptySubtext}>Tap + to create your first note</Text>
            </View>
          }
          style={styles.noteList}
          contentContainerStyle={styles.noteListContent}
          keyboardShouldPersistTaps="handled"
        />

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={createNewNote}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ===================== NOTE EDITOR SCREEN =====================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Editor Header */}
      <View style={styles.editorHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={goBackToList}>
          <Text style={styles.backBtnText}>{'\u2190'}</Text>
        </TouchableOpacity>

        <View style={styles.editorHeaderCenter}>
          <Text style={styles.editorHeaderTitle} numberOfLines={1}>
            {title || 'New Note'}
          </Text>
          {isSaving && (
            <Text style={styles.savingText}>saving...</Text>
          )}
        </View>

        <View style={styles.editorHeaderRight}>
          <Text style={[styles.syncBadge, { color: noteStatus.color }]}>
            {noteStatus.text || ''}
          </Text>
          <TouchableOpacity style={styles.headerBtn} onPress={syncNow}>
            <Text style={styles.headerBtnText}>{isSyncing ? '...' : '\u27F3'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Editor Body */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.editorBody}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TextInput
          style={styles.editorTitleInput}
          placeholder="Note title..."
          placeholderTextColor={COLORS.textSecondary}
          value={title}
          onChangeText={handleTitleChange}
          autoFocus={!title && !content}
          returnKeyType="next"
          blurOnSubmit
        />

        <TextInput
          style={styles.editorContentInput}
          placeholder="Start writing..."
          placeholderTextColor={COLORS.textSecondary}
          value={content}
          onChangeText={handleContentChange}
          multiline
          textAlignVertical="top"
          autoFocus={!!title || !!content}
          scrollEnabled
        />

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={copyNote}>
            <Text style={styles.toolBtnText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={clearNote}>
            <Text style={styles.toolBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolBtn, styles.toolBtnDanger]} onPress={deleteNote}>
            <Text style={[styles.toolBtnText, { color: COLORS.danger }]}>Delete</Text>
          </TouchableOpacity>
          {isSyncing && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

        {/* Stats */}
        <View style={styles.editorFooter}>
          <View style={styles.stats}>
            <Text style={styles.statText}>Chars: {stats.chars}</Text>
            <Text style={styles.statText}>Words: {stats.words}</Text>
            <Text style={styles.statText}>Lines: {stats.lines}</Text>
            <Text style={styles.statText}>Tokens: ~{stats.tokens}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- Common ---
  container: { flex: 1, backgroundColor: COLORS.background },

  // --- Loading ---
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 20 },

  // --- Login ---
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

  // --- Header ---
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { fontSize: 16 },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 16, color: COLORS.primary, fontWeight: '500' },

  // --- Search ---
  searchInput: {
    margin: 12, marginBottom: 4, padding: 10,
    backgroundColor: COLORS.surface, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    fontSize: 14, color: COLORS.text,
  },

  // --- Note List ---
  noteList: { flex: 1 },
  noteListContent: { paddingBottom: 80 },
  noteItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  noteItemRow: { flexDirection: 'row', alignItems: 'center' },
  noteItemIcon: { fontSize: 14, marginRight: 10, color: COLORS.textSecondary, width: 18 },
  noteItemContent: { flex: 1 },
  noteItemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  noteItemPreview: { fontSize: 13, color: COLORS.textSecondary },
  noteItemDate: { fontSize: 11, color: COLORS.textSecondary, marginLeft: 8 },

  // --- Empty State ---
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, color: COLORS.textSecondary, marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary },

  // --- Floating Action Button ---
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 30, fontWeight: '300' },

  // --- Editor Header ---
  editorHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8, marginRight: 4 },
  backBtnText: { fontSize: 22, color: COLORS.primary },
  editorHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  editorHeaderTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  savingText: { fontSize: 11, color: COLORS.textSecondary, marginLeft: 8, fontStyle: 'italic' },
  editorHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncBadge: { fontSize: 11, fontWeight: '500' },

  // --- Editor Body ---
  editorBody: {
    flex: 1, backgroundColor: COLORS.surface,
    margin: 12, borderRadius: 12, padding: 12,
  },
  editorTitleInput: {
    fontSize: 18, fontWeight: '600', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    marginBottom: 8, color: COLORS.text,
  },
  editorContentInput: {
    flex: 1, fontSize: 15, lineHeight: 22,
    color: COLORS.text, paddingVertical: 8,
    textAlignVertical: 'top',
  },

  // --- Toolbar ---
  toolbar: {
    flexDirection: 'row', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  toolBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  toolBtnDanger: { borderColor: '#fca5a5' },
  toolBtnText: { fontSize: 14, color: COLORS.text },

  // --- Editor Footer ---
  editorFooter: { paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { fontSize: 11, color: COLORS.textSecondary },
});
