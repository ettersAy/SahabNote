/**
 * Note List Screen — header, search bar, FlatList of notes, FAB.
 *
 * Props:
 *   notes          - full notes array
 *   search         - current search query
 *   setSearch      - setter for search query
 *   isOnline       - online/offline indicator
 *   isSyncing      - true while sync in progress
 *   syncNow        - function to trigger sync
 *   handleLogout   - logout handler
 *   createNewNote  - creates a new note and navigates to editor
 *   openNote       - opens a note for editing
 *   NoteItem       - component to render each note
 */

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, SafeAreaView, StatusBar, StyleSheet,
} from 'react-native';
import { COLORS } from '../constants/theme';

export default function NoteListScreen({
  notes, search, setSearch,
  isOnline, isSyncing, syncNow, handleLogout,
  createNewNote, openNote, NoteItemComponent,
}) {
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

  const filteredNotes = getFilteredNotes();

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
      <TextInput
        style={styles.searchInput}
        placeholder="Search notes..."
        placeholderTextColor={COLORS.textSecondary}
        value={search}
        onChangeText={setSearch}
      />

      {/* Note list */}
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.client_id}
        renderItem={({ item }) => <NoteItemComponent item={item} onPress={openNote} />}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

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
});
