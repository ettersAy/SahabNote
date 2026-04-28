/**
 * SahabNote - Android App (React Native / Expo)
 * Orchestrator / router — wires together hooks and screen components.
 */
import React, { useState, useEffect, useRef } from 'react';
import { loadNotes, saveNotes, getDeviceId, getSettings, createNoteObject } from './utils/storage';
import { SyncClient } from './utils/sync';
import { DEFAULT_SERVER_URL } from './constants/theme';
import useAuth from './hooks/useAuth';
import useSync from './hooks/useSync';
import useNoteEditor from './hooks/useNoteEditor';
import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import NoteListScreen from './components/NoteListScreen';
import NoteEditorScreen from './components/NoteEditorScreen';
import NoteItem from './components/NoteItem';

export default function App() {
  const [screen, setScreen] = useState('list');
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const syncClient = useRef(new SyncClient());
  const auth = useAuth(syncClient, setNotes);
  const sync = useSync(syncClient);
  const editor = useNoteEditor(notes, setNotes);
  useEffect(() => { initApp(); }, []);

  const initApp = async () => {
    setDeviceId(await getDeviceId());
    setNotes(await loadNotes());
    const saved = await getSettings();
    const authToken = saved.auth_token || '';
    syncClient.current.setServer(DEFAULT_SERVER_URL);
    syncClient.current.setAuthToken(authToken);
    if (authToken) {
      auth.setIsAuthenticated(true);
      sync.checkConnection();
      try { await auth.afterAuthSuccess(authToken); } catch {}
    }
    setIsLoading(false);
  };

  const createNewNote = async () => {
    const id = 'sn_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const note = createNoteObject(id, '', '', deviceId);
    const updated = [note, ...notes];
    await saveNotes(updated);
    setNotes(updated);
    editor.setCurrentNoteId(id);
    editor.setNoteStatus({ text: 'New note', color: '#6b7280' });
    setScreen('editor');
  };

  const openNote = (noteId) => {
    editor.saveCurrentNoteImmediate();
    const note = notes.find(n => n.client_id === noteId);
    if (note) { editor.openNote(note); setScreen('editor'); }
  };

  const goBackToList = () => {
    editor.saveCurrentNoteImmediate();
    setScreen('list');
    editor.resetEditor();
  };

  if (isLoading) return <LoadingScreen />;

  if (!auth.isAuthenticated) {
    return (
      <LoginScreen
        loginUser={auth.loginUser} setLoginUser={auth.setLoginUser}
        loginPass={auth.loginPass} setLoginPass={auth.setLoginPass}
        doLogin={auth.doLogin} doRegister={auth.doRegister}
        authLoading={auth.authLoading} authLoadingText={auth.authLoadingText}
      />
    );
  }

  if (screen === 'list') {
    return (
      <NoteListScreen
        notes={notes} search={search} setSearch={setSearch}
        isOnline={sync.isOnline} isSyncing={sync.isSyncing}
        syncNow={() => sync.syncNow(editor.saveCurrentNoteImmediate)}
        handleLogout={() => auth.handleLogout(editor.saveCurrentNoteImmediate).then(() => { setScreen('list'); editor.resetEditor(); })}
        createNewNote={createNewNote} openNote={openNote} NoteItemComponent={NoteItem}
      />
    );
  }

  return (
    <NoteEditorScreen
      title={editor.title} content={editor.content}
      stats={editor.stats} noteStatus={editor.noteStatus}
      isSaving={editor.isSaving} isSyncing={sync.isSyncing}
      handleTitleChange={editor.handleTitleChange}
      handleContentChange={editor.handleContentChange}
      goBackToList={goBackToList}
      syncNow={() => sync.syncNow(editor.saveCurrentNoteImmediate)}
      copyNote={editor.copyNote} clearNote={editor.clearNote} deleteNote={editor.deleteNote}
    />
  );
}
