# Task: UI Polish and Testing

**Context:** The two-screen navigation redesign fixed core usability issues. The following enhancements would further improve the user experience and development safety.

## Goals

### 1. Pull-to-refresh on note list

Add `RefreshControl` to the note FlatList so users can manually refresh notes by pulling down. This also triggers a sync if online.

**Implementation sketch:**
```jsx
<FlatList
  refreshControl={
    <RefreshControl refreshing={isRefreshing} onRefresh={syncNow} />
  }
  ...
/>
```

### 2. Search debounce

The search input currently filters on every keystroke. For larger note collections, debounce the search filter by 300ms to avoid unnecessary re-renders.

**Implementation sketch:**
```jsx
const [searchQuery, setSearchQuery] = useState('');
const debouncedSearch = useDebounce(searchQuery, 300);
// filter using debouncedSearch instead of searchQuery
```

A `useDebounce` hook would be needed (or import from a utility library).

### 3. Loading/skeleton states

The app currently shows a spinner during initial load but has no loading states for:
- Note creation (brief moment between tap and editor appearing)
- Sync operation (has a spinner, but no message about what's happening)
- Login/register (spinner + text, which is adequate)

**Proposal:**
- Add a subtle overlay during sync with text: "Syncing..."
- Use `ActivityIndicator` inline (already done for sync) — extend to note creation

### 4. E2E test with Detox or Maestro

Add an end-to-end test for the critical user flow:

1. Open app → see loading screen
2. Login → see note list with empty state
3. Tap FAB → see editor with empty title/content
4. Type title and content → verify auto-save indicator appears
5. Tap back → see note in list with preview
6. Tap note → see editor with saved content
7. Long-press note → show delete confirmation
8. Delete → note disappears from list

**Stack recommendation:** [Maestro](https://maestro.mobile.dev/) (free, declarative YAML tests, works with Expo)

**Example `flows/create-note.yaml`:**
```yaml
appId: com.ayoube.SahabNote
---
- tapOn: "Username"
- inputText: "testuser"
- tapOn: "Password"
- inputText: "testpass"
- tapOn: "Login"
- assertVisible: "No notes yet"
- tapOn: "+"
- assertVisible: "Note title"
- inputText: "My Test Note"
- assertVisible: "saving..."
- goBack: true  # or tap the back arrow
```

### 5. Keyboard dismissal on scroll

When the search input has focus and the user scrolls the note list, dismiss the keyboard.

**Implementation:** Add `keyboardShouldPersistTaps="never"` or wrap with `Keyboard.dismiss()` on scroll start.

## Acceptance Criteria

- [ ] Pull-to-refresh works and syncs notes
- [ ] Search input is debounced (300ms)
- [ ] Loading states shown during sync and note creation
- [ ] E2E test covers login → create → edit → delete flow
- [ ] Keyboard dismisses on list scroll when search is focused

## Priority: Low-Medium

These are polish items. User-facing improvements but not blocking any functionality.
