# Traps in Rust commands and the phone bridge

> **Read this when** you change a Rust command, the phone bridge, the
> credential store or the window close path. **Not for** provider CLIs
> ([providers.md](providers.md)) or git reads ([git.md](git.md)).

## Phone bridge

### The bridge socket wire

- Server to client opcodes are 0x01 to 0x0E (0x0E is the handshake refusal); client reads are 0x80 to 0x82. Neither group may resolve to an action.
- Writes (0x83 to 0x86, 0x8C and 0x8D, the decide set 0x90 to 0x9D, and 0x9E to 0xA1 for the checked merge, the train, start and stop train) decode through `MobileAction::from_opcode`, a closed set in `bridge/commands.rs`. `commandExecutor.ts` switches on the action strings: change both together.
- A read-only action (`QueryProviders`) answers `OP_QUERY_RESULT` with a `data` field; every write answers an ACK. A command the frontend does not acknowledge in time is reported to the phone as failed.
- The phone may send a correlation id, else the bridge mints one. It is the only phone-controlled field read there.

### The Noise XK handshake order

msg1 carries the version 2 hello (the token only on an enrollment), msg2 answers, msg3 reveals the phone's static key. The desktop reads the hello before msg2 but decides only after msg3, because a refusal travels encrypted and the phone needs the keys to read it. An enrollment adds the phone to the list; a re-dial needs it there.

A stop trips one shared signal and every live connection leaves at once, so check it before entering the live loop as well as inside it. Disconnecting one phone does not trip it: that connection ends at its next ping.

### Goodboy must be open

The phone reads what the main window publishes, never the database: the bridge keeps the last projection per key and has no other source. When the window reloads or closes, nothing arrives for 10 seconds and the phone is told `isOpen: false`. The next window starts a new epoch and the bridge drops the old keys.

A new projection kind needs the contract type, the struct in `bridge/publish_schema.rs` and its builder, together. The Rust tests read the golden files in `features/companion/projections/fixtures/`, so a field the schema lacks fails there instead of vanishing on the wire. A frame is capped at 65535 bytes, so a projection is capped at 56,000 and lists are cut before it.

### The pairing identity is owner-only

`bridge/identity.rs` holds the desktop's long-term Noise private key, written with owner-only permissions. Forgetting devices empties the phone list, and a phone then needs a fresh QR that only the desktop shows. A pairing token is single-use, burned on its first match.

## Commands and files

### Credentials resolve in three tiers

`integration_credentials.rs` tries the project override, then the workspace binding, then a credential no binding claims. Only the credential's own id reaches the keychain. A bound credential with no secret is an error, never a reason to try another; only the unbound tier may skip one it cannot read.

The per-scope configuration stays on the binding, or a shared credential would overwrite another scope's. The boot adoption is safe to rerun: it moves keys and never rewrites a secret. A credential no binding claims and no keychain entry backs is deleted by row, row before secret, so the foreign key refuses while a binding still names it.

### A deleted workflow stays on its session

`workflows_for_session` adds to `workflow_list` the soft-deleted presets that `session_workflows` still names, so the session that started one keeps seeing it. `origin` is `library`, `custom` or `orchestrated`, absent on older rows. The set of workspaces with an unviewed terminal turn lets the sidebar pulse the dot of a workspace whose tasks are not loaded.

### A shared file is replaced, never rewritten

`util::write_atomic` writes a synced temporary file next to the target and renames it over, removing it on failure. Use it for every file a second reader can open during the write: an export, the zsh startup files, the folder version index, and the Cursor Max Mode config two Cursor turns share. A plain `fs::write` truncates first, so the reader sees an empty or half file.

### Rust returns a kind and its numbers, never a sentence

`AuthState.reason` (`AuthReason`), the connection test (`ConnectionOutcome`) and the chat refusal (`not_read_only`) reach the screen through one TypeScript function each: `authReasonSentence`, `outcomeSentenceOf` in `ConnectionTest`, `chatStartError`. A Rust sentence drifts from the app's words, and a typed duration drifts from the command's deadline.

A new failure adds a variant with its payload (the seconds, the code, the CLI text as `detail`) and a case in the TypeScript function; the `never` default lists the missing case. A `ChatError`'s `message` is for logs only.

### A window close goes through one guard, with a Rust fallback

Tauri hands a close to the page once one `onCloseRequested` listener exists, and every listener destroys the window unless it calls `preventDefault`. So the page registers one listener (`onWindowClose` in `features/workspace/window.ts`) and every other close step joins it as a callback; a second `getCurrentWindow().onCloseRequested` would destroy the window before the sheet can ask.

1. The listener claims the close (`window_close_claim`).
2. It races the guard (`setWindowCloseGuard`, owned by `WindowCloseSheet`) against 2 seconds (`decideWindowClose`).
3. A page too frozen to claim is closed by Rust after the same 2 seconds (`window_close.rs`).

On macOS the main window hides instead of closing, because it hosts the Auto runtime. The dock icon shows it again (`RunEvent::Reopen`), and `focusWindow` shows a hidden window before focusing it. Elsewhere the main window closes and Auto stops with it.
