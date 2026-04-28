/**
 * Single note row rendered in the note list.
 *
 * Props:
 *   item    - note object from the notes array
 *   onPress - callback(noteId) when tapped
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { SYNC_STATUS } from '../utils/storage';

export default function NoteItem({ item, onPress }) {
  const icons = {
    [SYNC_STATUS.SYNCED]: '\u2713',
    [SYNC_STATUS.LOCAL_ONLY]: '+',
    [SYNC_STATUS.PENDING_SYNC]: '\u27F3',
    [SYNC_STATUS.CONFLICT]: '!',
  };
  const displayTitle = item.title || item.content?.slice(0, 50) || 'Untitled';
  const preview = item.content ? item.content.slice(0, 80).replace(/\n/g, ' ') : '';
  const dateStr = item.updated_at
    ? new Date(item.updated_at).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <TouchableOpacity
      style={styles.noteItem}
      onPress={() => onPress(item.client_id)}
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
}

const styles = StyleSheet.create({
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
});
