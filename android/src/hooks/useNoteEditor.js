/**
 * Note editor state management hook.
 *
 * Manages: currentNoteId, title, content, stats, noteStatus, isSaving,
 * auto-save logic, and editor actions (save, copy, clear, delete).
 */

import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { saveNotes, SYNC_STATUS } from '../utils/storage';
import { COLORS } from '../constants/theme';

export default function useNoteEditor(notes, setNotes) {
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [stats, setStats] = useState({ chars: 0, words: 0, lines: 0, tokens: 0 });
  const [noteStatus, setNoteStatus] = useState({ text: '', color: COLORS.textSecondary });
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimer = useRef(null);

  // ===================== Stats & Status UI =====================

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

  // ===================== Auto-Save =====================

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
  }, [currentNoteId, title, content, notes, setNotes]);

  const scheduleAutoSave = () => {
    setIsSaving(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveCurrentNoteImmediate().then(() => setIsSaving(false));
    }, 1500);
  };

  const handleTitleChange = (t) => { setTitle(t); scheduleAutoSave(); };
  const handleContentChange = (c) => { setContent(c); updateStats(c); scheduleAutoSave(); };

  // ===================== Editor Actions =====================

  const resetEditor = () => {
    setCurrentNoteId(null);
    setTitle('');
    setContent('');
    setStats({ chars: 0, words: 0, lines: 0, tokens: 0 });
    setNoteStatus({ text: '', color: COLORS.textSecondary });
  };

  const openNote = (note) => {
    if (!note) return;
    setCurrentNoteId(note.client_id);
    setTitle(note.title || '');
    setContent(note.content || '');
    updateStats(note.content || '');
    updateNoteStatusUI(note);
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
        text: 'Clear', style: 'destructive', onPress: () => {
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
        },
      },
    ]);
  };

  const deleteNote = () => {
    if (!currentNoteId) return;
    const note = notes.find(n => n.client_id === currentNoteId);
    const titleStr = note?.title || 'Untitled';
    Alert.alert('Delete Note', 'Delete "' + titleStr + '"?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const now = new Date().toISOString();
          const updated = notes.map(n =>
            n.client_id === currentNoteId
              ? { ...n, deleted_at: now, sync_status: SYNC_STATUS.DELETED_PENDING }
              : n
          );
          await saveNotes(updated);
          setNotes(updated);
          resetEditor();
        },
      },
    ]);
  };

  return {
    // State
    currentNoteId, setCurrentNoteId,
    title, setTitle,
    content, setContent,
    stats, noteStatus, isSaving,
    // Actions
    saveCurrentNoteImmediate,
    handleTitleChange, handleContentChange,
    updateStats, updateNoteStatusUI,
    copyNote, clearNote, deleteNote,
    openNote, resetEditor,
  };
}
