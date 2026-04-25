# Incident Report: Chrome Extension Service Worker Registration & Alarms API

- **Date:** 2026-04-25
- **Component:** `chrome-extension/` (Manifest V3)
- **Impact:** Chrome extension failed to load — service worker registration error, background.js crash
- **Severity:** High (extension entirely non-functional)
- **Status:** Resolved → PR [#2](https://github.com/ettersAy/SahabNote/pull/2)

---

## Symptoms

When loading the unpacked extension in `chrome://extensions`, the following errors appeared in the extension's error console (`#errorsList`):

1. **Service worker registration failed. Status code: 15**
2. **Uncaught TypeError: Cannot read properties of undefined (reading 'onAlarm')**
   - Context: `background.js`
   - Stack Trace: `background.js:36 (anonymous function)`

---

## Root Cause Analysis

### Error 1: Status Code 15 (Service Worker Registration)

**Root Cause:** The `manifest.json` declared the background service worker with `"type": "module"`:

```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

However, `background.js` contains no `import` or `export` statements — it is a plain script. Declaring `"type": "module"` on a non-module script can cause the service worker registration to fail (status code 15) in some browser versions due to the browser attempting to parse the file as an ES module and failing.

**Fix:** Removed `"type": "module"` from the background declaration. MV3 service workers default to classic scripts when `type` is omitted.

### Error 2: `chrome.alarms` is undefined → `Cannot read properties of undefined (reading 'onAlarm')`

**Root Cause:** The `background.js` uses the `chrome.alarms` API (`chrome.alarms.create()` and `chrome.alarms.onAlarm.addListener()`), but the `"alarms"` permission was **missing** from the `manifest.json`:

```json
{
  "permissions": [
    "storage",
    "unlimitedStorage"
    // "alarms" was missing!
  ]
}
```

Without the `"alarms"` permission, `chrome.alarms` is `undefined`, causing the crash at line 36 where `chrome.alarms.onAlarm` is accessed.

**Fix:** Added `"alarms"` to the `permissions` array in `manifest.json`, and added defensive null-checks (`if (chrome.alarms)`) with a `setInterval` fallback for resilience.

---

## Resolution

| Action | File | Description |
|--------|------|-------------|
| ✅ Added `"alarms"` permission | `manifest.json` | Required for `chrome.alarms` API |
| ✅ Removed `"type": "module"` | `manifest.json` | Not needed — script has no imports/exports |
| ✅ Added null-checks | `background.js` | Defensive guards around `chrome.alarms` with `setInterval` fallback |

---

## Lessons Learned / Prevention Checklist

When creating/modifying a Chrome Extension MV3 service worker:

- [ ] Verify all `chrome.*` APIs used in `background.js` have corresponding permissions in `manifest.json`
- [ ] Do NOT add `"type": "module"` unless the background script actually uses `import`/`export`
- [ ] Add defensive null-checks around optional Chrome APIs with a graceful fallback
- [ ] Always check `chrome://extensions` error panel after loading — it catches these issues immediately
- [ ] Test with browser console open to catch runtime errors on extension install

---

## Commands Used for Investigation

```bash
# Extract errors from the extension's error panel
# (executed via browser DevTools console)
document.querySelectorAll('#errorsList .item-container')
  .forEach(el => console.log(el.innerText.trim()))
```

---

## Related PR

- **PR:** [#2](https://github.com/ettersAy/SahabNote/pull/2) — `fix/chrome-extension-alarms-permission`
- **Branch:** `fix/chrome-extension-alarms-permission`
- **Base:** `main`
