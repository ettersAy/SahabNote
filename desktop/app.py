"""SahabNote Desktop App - A lightweight note-taking client."""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import threading
import time
import uuid
from datetime import datetime, timezone

from local_store import (
    load_notes, save_notes, create_note, add_note, update_note,
    delete_note, get_note, get_pending_sync_notes,
    mark_synced, mark_conflict, merge_pulled_notes,
    get_device_id, get_settings, save_settings,
    SYNC_STATUS
)
from sync_client import SyncClient


class SahabNoteApp:
    def __init__(self, root):
        self.root = root
        self.root.title("SahabNote")
        self.root.geometry("1000x650")
        self.root.minsize(800, 500)

        # State
        self.current_note_id = None  # client_id
        self.notes = []
        self.sync_client = SyncClient()
        self.device_id = get_device_id()
        self.online = False

        # Load settings
        settings = get_settings()
        self.server_url = settings.get("server_url", "http://localhost:8000")
        self.auth_token = settings.get("auth_token", "")
        self.sync_client.set_server(self.server_url)
        self.sync_client.set_auth_token(self.auth_token)

        # Load local notes
        self.notes = load_notes()

        # Setup UI
        self.setup_ui()
        self.refresh_note_list()
        self.check_connection()

        # Auto-save timer
        self.auto_save_id = None

    def setup_ui(self):
        # Main paned window
        self.paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned.pack(fill=tk.BOTH, expand=True)

        # Left panel - Note list
        left_frame = ttk.Frame(self.paned, width=280)
        self.paned.add(left_frame, weight=0)

        # Note list header
        header_frame = ttk.Frame(left_frame)
        header_frame.pack(fill=tk.X, padx=5, pady=(5, 0))

        ttk.Label(header_frame, text="Notes", font=("", 14, "bold")).pack(side=tk.LEFT)
        self.sync_status_label = ttk.Label(header_frame, text="●", foreground="gray")
        self.sync_status_label.pack(side=tk.RIGHT, padx=5)
        self.online_label = ttk.Label(header_frame, text="○ offline", foreground="gray", font=("", 9))
        self.online_label.pack(side=tk.RIGHT, padx=5)

        # Search/Filter
        self.search_var = tk.StringVar()
        self.search_var.trace("w", lambda *a: self.filter_notes())
        search_entry = ttk.Entry(left_frame, textvariable=self.search_var)
        search_entry.pack(fill=tk.X, padx=5, pady=5)
        search_entry.insert(0, "Search notes...")
        search_entry.bind("<FocusIn>", lambda e: search_entry.delete(0, tk.END) if search_entry.get() == "Search notes..." else None)

        # Note listbox with scrollbar
        list_frame = ttk.Frame(left_frame)
        list_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=(0, 5))

        self.note_listbox = tk.Listbox(list_frame, selectmode=tk.SINGLE,
                                        font=("", 11), borderwidth=0,
                                        highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.note_listbox.yview)
        self.note_listbox.configure(yscrollcommand=scrollbar.set)

        self.note_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.note_listbox.bind("<<ListboxSelect>>", self.on_note_select)

        # Buttons under list
        btn_frame = ttk.Frame(left_frame)
        btn_frame.pack(fill=tk.X, padx=5, pady=(0, 5))

        ttk.Button(btn_frame, text="+ New Note", command=self.new_note).pack(side=tk.LEFT, padx=(0, 2))
        ttk.Button(btn_frame, text="Settings", command=self.open_settings).pack(side=tk.RIGHT)
        ttk.Button(btn_frame, text="Sync Now", command=self.sync_now).pack(side=tk.RIGHT, padx=(0, 2))

        # Right panel - Editor
        right_frame = ttk.Frame(self.paned)
        self.paned.add(right_frame, weight=1)

        # Title
        title_frame = ttk.Frame(right_frame)
        title_frame.pack(fill=tk.X, padx=10, pady=(10, 5))

        self.title_var = tk.StringVar()
        self.title_entry = ttk.Entry(title_frame, textvariable=self.title_var, font=("", 14))
        self.title_entry.pack(fill=tk.X)
        self.title_entry.bind("<KeyRelease>", self.on_text_change)

        # Status bar below title
        status_frame = ttk.Frame(right_frame)
        status_frame.pack(fill=tk.X, padx=10, pady=(0, 5))

        self.note_status_label = ttk.Label(status_frame, text="No note selected", font=("", 9), foreground="gray")
        self.note_status_label.pack(side=tk.LEFT)
        self.last_saved_label = ttk.Label(status_frame, text="", font=("", 9), foreground="gray")
        self.last_saved_label.pack(side=tk.RIGHT)

        # Editor text area
        editor_frame = ttk.Frame(right_frame)
        editor_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 5))

        self.editor_text = tk.Text(editor_frame, wrap=tk.WORD, font=("", 12),
                                    borderwidth=1, relief=tk.SOLID,
                                    padx=8, pady=8, undo=True)
        editor_scrollbar = ttk.Scrollbar(editor_frame, orient=tk.VERTICAL, command=self.editor_text.yview)
        self.editor_text.configure(yscrollcommand=editor_scrollbar.set)
        self.editor_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        editor_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.editor_text.bind("<KeyRelease>", self.on_text_change)

        # Action buttons
        action_frame = ttk.Frame(right_frame)
        action_frame.pack(fill=tk.X, padx=10, pady=(0, 5))

        self.save_btn = ttk.Button(action_frame, text="💾 Save", command=self.save_current_note, state=tk.DISABLED)
        self.save_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.copy_btn = ttk.Button(action_frame, text="📋 Copy", command=self.copy_note, state=tk.DISABLED)
        self.copy_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.clear_btn = ttk.Button(action_frame, text="🗑 Clear", command=self.clear_note, state=tk.DISABLED)
        self.clear_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.delete_btn = ttk.Button(action_frame, text="✕ Delete", command=self.delete_current_note, state=tk.DISABLED)
        self.delete_btn.pack(side=tk.LEFT, padx=(0, 5))

        # Footer with statistics
        footer_frame = ttk.Frame(right_frame)
        footer_frame.pack(fill=tk.X, padx=10, pady=(0, 10))

        self.char_count_label = ttk.Label(footer_frame, text="Chars: 0", font=("", 9))
        self.char_count_label.pack(side=tk.LEFT, padx=(0, 15))

        self.word_count_label = ttk.Label(footer_frame, text="Words: 0", font=("", 9))
        self.word_count_label.pack(side=tk.LEFT, padx=(0, 15))

        self.line_count_label = ttk.Label(footer_frame, text="Lines: 0", font=("", 9))
        self.line_count_label.pack(side=tk.LEFT, padx=(0, 15))

        self.token_count_label = ttk.Label(footer_frame, text="Tokens: ~0", font=("", 9))
        self.token_count_label.pack(side=tk.LEFT)

    def filter_notes(self):
        self.refresh_note_list()

    def refresh_note_list(self):
        self.note_listbox.delete(0, tk.END)
        search = self.search_var.get().lower()
        filtered = self.notes
        if search and search != "search notes...":
            filtered = [n for n in self.notes if
                       search in n.get("title", "").lower() or
                       search in n.get("content", "").lower()]

        for note in filtered:
            if note.get("deleted_at"):
                continue
            title = note.get("title", "").strip()
            if not title:
                # Auto-generate title from content
                content = note.get("content", "")
                title = content[:50] + "..." if len(content) > 50 else content or "Untitled"
            status_icon = {
                "synced": "✓",
                "local_only": "+",
                "pending_sync": "⟳",
                "sync_conflict": "!",
                "deleted_pending_sync": "✕",
            }.get(note.get("sync_status", ""), "?")
            display = f"{status_icon} {title}"
            self.note_listbox.insert(tk.END, display)

    def on_note_select(self, event):
        selection = self.note_listbox.curselection()
        if not selection:
            return
        index = selection[0]
        # Map to actual note (filtered)
        search = self.search_var.get().lower()
        filtered = self.notes
        if search and search != "search notes...":
            filtered = [n for n in self.notes if
                       search in n.get("title", "").lower() or
                       search in n.get("content", "").lower()]
        if index < len(filtered):
            note = filtered[index]
            self.load_note(note.get("client_id") or note.get("id"))

    def load_note(self, note_id):
        note = get_note(note_id) if note_id else None
        if not note:
            return

        # Save any changes to current note first
        if self.current_note_id and self.current_note_id != note_id:
            self.save_current_note()

        self.current_note_id = note.get("client_id") or note.get("id")
        self.title_var.set(note.get("title", ""))
        self.editor_text.delete("1.0", tk.END)
        self.editor_text.insert("1.0", note.get("content", ""))

        # Update status
        status_text = note.get("sync_status", "unknown")
        status_colors = {
            "synced": "green",
            "local_only": "orange",
            "pending_sync": "blue",
            "sync_conflict": "red",
            "deleted_pending_sync": "gray",
        }
        self.note_status_label.config(
            text=f"Status: {status_text}",
            foreground=status_colors.get(status_text, "gray")
        )
        self.last_saved_label.config(text=f"Updated: {note.get('updated_at', '')[:19]}")

        # Enable buttons
        self.save_btn.config(state=tk.NORMAL)
        self.copy_btn.config(state=tk.NORMAL)
        self.clear_btn.config(state=tk.NORMAL)
        self.delete_btn.config(state=tk.NORMAL)

        self.update_stats()

    def on_text_change(self, event=None):
        self.update_stats()
        if self.current_note_id:
            self.save_btn.config(state=tk.NORMAL)
            # Auto-save after 2 seconds of inactivity
            if self.auto_save_id:
                self.root.after_cancel(self.auto_save_id)
            self.auto_save_id = self.root.after(2000, self.save_current_note)

    def update_stats(self):
        content = self.editor_text.get("1.0", tk.END).rstrip("\n")
        chars = len(content)
        words = len(content.split()) if content.strip() else 0
        lines = content.count("\n") + (1 if content else 0)
        tokens = max(1, chars // 4)

        self.char_count_label.config(text=f"Chars: {chars}")
        self.word_count_label.config(text=f"Words: {words}")
        self.line_count_label.config(text=f"Lines: {lines}")
        self.token_count_label.config(text=f"Tokens: ~{tokens}")

    def save_current_note(self):
        if not self.current_note_id:
            return
        title = self.title_var.get().strip()
        content = self.editor_text.get("1.0", tk.END).rstrip("\n")

        # Auto-generate title from first line if empty
        if not title:
            first_line = content.split("\n")[0] if content else ""
            title = first_line[:80] if first_line else "Untitled"

        result = update_note(self.current_note_id, title, content)
        if result:
            self.save_btn.config(state=tk.DISABLED)
            self.last_saved_label.config(
                text=f"Saved: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}"
            )
            self.notes = load_notes()
            self.refresh_note_list()

    def new_note(self):
        # Save current first
        self.save_current_note()
        note = create_note()
        self.notes = add_note(note)
        self.refresh_note_list()
        self.load_note(note.get("client_id"))

    def copy_note(self):
        if not self.current_note_id:
            return
        content = self.editor_text.get("1.0", tk.END).rstrip("\n")
        self.root.clipboard_clear()
        self.root.clipboard_append(content)
        self.note_status_label.config(text="Copied to clipboard!", foreground="green")
        self.root.after(2000, lambda: self.load_note(self.current_note_id))

    def clear_note(self):
        if not self.current_note_id:
            return
        if messagebox.askyesno("Clear Note", "Clear all content?"):
            self.editor_text.delete("1.0", tk.END)
            self.title_var.set("")
            self.update_stats()
            self.save_current_note()

    def delete_current_note(self):
        if not self.current_note_id:
            return
        note = get_note(self.current_note_id)
        title = note.get("title", "Untitled") if note else "Untitled"
        if messagebox.askyesno("Delete Note", f'Delete "{title}"?'):
            delete_note(self.current_note_id)
            self.notes = load_notes()
            self.refresh_note_list()
            self.current_note_id = None
            self.title_var.set("")
            self.editor_text.delete("1.0", tk.END)
            self.note_status_label.config(text="Note deleted", foreground="gray")
            self.save_btn.config(state=tk.DISABLED)
            self.copy_btn.config(state=tk.DISABLED)
            self.clear_btn.config(state=tk.DISABLED)
            self.delete_btn.config(state=tk.DISABLED)
            self.update_stats()

    def check_connection(self):
        def _check():
            try:
                resp = self.sync_client.health_check()
                is_online = resp.get("status") == "ok"
            except Exception:
                is_online = False

            self.root.after(0, lambda: self._update_connection_status(is_online))
            # Check again every 30 seconds
            self.root.after(30000, self.check_connection)

        threading.Thread(target=_check, daemon=True).start()

    def _update_connection_status(self, is_online):
        self.online = is_online
        if is_online:
            self.online_label.config(text="● online", foreground="green")
        else:
            self.online_label.config(text="○ offline", foreground="gray")
        self.update_sync_status()

    def update_sync_status(self):
        pending = len(get_pending_sync_notes())
        if pending > 0:
            self.sync_status_label.config(text=f"⟳ {pending} pending", foreground="orange")
        else:
            self.sync_status_label.config(text="✓ synced", foreground="green")

    def sync_now(self):
        if not self.server_url or not self.auth_token:
            messagebox.showwarning("Sync", "Please configure server URL and auth token in Settings first.")
            return

        if not self.online:
            messagebox.showwarning("Sync", "Cannot sync: offline. Queued changes will sync when online.")
            return

        def _sync():
            self.root.after(0, lambda: self.note_status_label.config(text="Syncing...", foreground="blue"))

            try:
                # 1. Push pending changes
                pending = get_pending_sync_notes()
                push_items = []
                for n in pending:
                    push_items.append({
                        "client_id": n.get("client_id"),
                        "title": n.get("title", ""),
                        "content": n.get("content", ""),
                        "version": n.get("version", 1),
                        "device_id": n.get("device_id", ""),
                        "deleted": n.get("sync_status") == SYNC_STATUS["DELETED_PENDING"],
                    })

                if push_items:
                    push_resp = self.sync_client.sync_push(push_items)
                    if push_resp.get("success"):
                        for item in push_resp.get("data", {}).get("synced", []):
                            mark_synced(
                                item["client_id"],
                                item.get("server_id", 0),
                                item.get("version", 1)
                            )
                    # Handle conflicts
                    for conflict in push_resp.get("data", {}).get("conflicts", []):
                        mark_conflict(conflict["client_id"], conflict["server_note"])

                # 2. Pull server changes
                pull_resp = self.sync_client.sync_pull()
                if pull_resp.get("success"):
                    pulled = pull_resp.get("data", {}).get("notes", [])
                    if pulled:
                        merge_pulled_notes(pulled)

                # Reload notes
                self.notes = load_notes()
                self.root.after(0, self.refresh_note_list)
                self.root.after(0, self.update_sync_status)
                self.root.after(0, lambda: self.note_status_label.config(text="Sync complete!", foreground="green"))
                self.root.after(3000, lambda: self.load_note(self.current_note_id) if self.current_note_id else None)

            except Exception as e:
                self.root.after(0, lambda: self.note_status_label.config(
                    text=f"Sync failed: {str(e)}", foreground="red"
                ))

        threading.Thread(target=_sync, daemon=True).start()

    def open_settings(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("Settings")
        dialog.geometry("500x350")
        dialog.resizable(False, False)
        dialog.transient(self.root)
        dialog.grab_set()

        frame = ttk.Frame(dialog, padding=20)
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="Server Settings", font=("", 12, "bold")).pack(anchor=tk.W)

        ttk.Label(frame, text="Server URL:").pack(anchor=tk.W, pady=(10, 0))
        server_var = tk.StringVar(value=self.server_url)
        ttk.Entry(frame, textvariable=server_var, width=60).pack(fill=tk.X, pady=(2, 5))

        ttk.Label(frame, text="Auth Token or Sync Key:").pack(anchor=tk.W)
        token_var = tk.StringVar(value=self.auth_token)
        token_entry = ttk.Entry(frame, textvariable=token_var, width=60, show="*")
        token_entry.pack(fill=tk.X, pady=(2, 5))

        show_token_var = tk.BooleanVar(value=False)
        def toggle_token_visibility():
            token_entry.config(show="" if show_token_var.get() else "*")
        ttk.Checkbutton(frame, text="Show token", variable=show_token_var,
                        command=toggle_token_visibility).pack(anchor=tk.W)

        ttk.Label(frame, text=f"Device ID: {self.device_id[:20]}...",
                  font=("", 8), foreground="gray").pack(anchor=tk.W, pady=(10, 0))

        # Quick register/login section
        ttk.Separator(frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        ttk.Label(frame, text="Quick Account Setup", font=("", 10)).pack(anchor=tk.W)

        reg_frame = ttk.Frame(frame)
        reg_frame.pack(fill=tk.X, pady=(5, 0))

        ttk.Label(reg_frame, text="Username:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        reg_user = tk.StringVar()
        ttk.Entry(reg_frame, textvariable=reg_user, width=20).grid(row=0, column=1, sticky=tk.W)

        ttk.Label(reg_frame, text="Password:").grid(row=0, column=2, sticky=tk.W, padx=(10, 5))
        reg_pass = tk.StringVar()
        ttk.Entry(reg_frame, textvariable=reg_pass, width=20, show="*").grid(row=0, column=3, sticky=tk.W)

        status_label = ttk.Label(frame, text="", foreground="blue")
        status_label.pack(anchor=tk.W, pady=(5, 0))

        def do_register():
            u, p = reg_user.get(), reg_pass.get()
            if not u or not p:
                status_label.config(text="Fill username and password", foreground="red")
                return
            self.sync_client.set_server(server_var.get())
            resp = self.sync_client.register(u, p)
            if resp.get("success"):
                token_var.set(resp["data"]["access_token"])
                status_label.config(text=f"Registered! Sync key: {resp['data']['sync_key'][:20]}...", foreground="green")
            else:
                status_label.config(text=f"Failed: {resp.get('message', 'error')}", foreground="red")

        def do_login():
            u, p = reg_user.get(), reg_pass.get()
            if not u or not p:
                status_label.config(text="Fill username and password", foreground="red")
                return
            self.sync_client.set_server(server_var.get())
            resp = self.sync_client.login(u, p)
            if resp.get("success"):
                token_var.set(resp["data"]["access_token"])
                status_label.config(text=f"Logged in! Sync key: {resp['data']['sync_key'][:20]}...", foreground="green")
            else:
                status_label.config(text=f"Failed: {resp.get('message', 'error')}", foreground="red")

        btn_reg_frame = ttk.Frame(frame)
        btn_reg_frame.pack(fill=tk.X, pady=(5, 0))
        ttk.Button(btn_reg_frame, text="Register", command=do_register).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_reg_frame, text="Login", command=do_login).pack(side=tk.LEFT)

        def save_settings_callback():
            self.server_url = server_var.get().rstrip("/")
            self.auth_token = token_var.get()
            self.sync_client.set_server(self.server_url)
            self.sync_client.set_auth_token(self.auth_token)
            save_settings({
                "server_url": self.server_url,
                "auth_token": self.auth_token,
            })
            self.check_connection()
            dialog.destroy()

        btn_frame = ttk.Frame(dialog, padding=10)
        btn_frame.pack(fill=tk.X)
        ttk.Button(btn_frame, text="Save", command=save_settings_callback).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(btn_frame, text="Cancel", command=dialog.destroy).pack(side=tk.RIGHT)


def main():
    root = tk.Tk()
    app = SahabNoteApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
