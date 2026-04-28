/**
 * Note Editor Screen — full-screen editor with back button, auto-save, toolbar, stats.
 *
 * Props:
 *   title, content, stats, noteStatus, isSaving, isSyncing
 *   handleTitleChange, handleContentChange
 *   goBackToList, syncNow, copyNote, clearNote, deleteNote
 */

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import { COLORS } from '../constants/theme';

export default function NoteEditorScreen({
  title, content, stats, noteStatus, isSaving, isSyncing,
  handleTitleChange, handleContentChange,
  goBackToList, syncNow, copyNote, clearNote, deleteNote,
}) {
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
  container: { flex: 1, backgroundColor: COLORS.background },

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
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 16, color: COLORS.primary, fontWeight: '500' },

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
