# ADR 002: the boot path leaves the UI thread

> **Read this when** you add or change a Tauri command the boot sequence
> reaches, touch the boot breadcrumb sink, or need why the main window starts
> hidden. **Not for** what the sink may write ([SECURITY.md](../../SECURITY.md))
> or the release check that the window appears ([testing.md](../testing.md)).

Status: accepted, shipped in 0.1.80 (#1397); breadcrumb timing amended in
0.1.81.

## Context

Launches of 0.1.79 often showed a window with a title bar and nothing in it,
and the splash never appeared although it was wired to every boot phase. The
database commands every boot query goes through (`db_exec`, `db_execute`,
`db_select`) were synchronous `#[tauri::command]` functions. A synchronous
Tauri command runs on the main thread, which on macOS is the UI thread, and a
window whose main thread is parked paints nothing: not React, not a static
element. The splash was never the failing part.

`apps/desktop/index.html` paints the charcoal background from an inline style
as soon as the document is parsed, but the window itself declared no
background, so anything before the document showed the platform default. And
nothing recorded how far a launch got, so a user whose app did not paint had
nothing to attach to an issue.

## Decision

- **No command on the boot path parks the UI thread.** Every command that
  `apps/desktop/src/store/slices/boot/hydrate.ts` reaches and that touches the
  database, the file system, a lock or a subprocess is declared
  `#[tauri::command(async)]` or as an `async fn`. A synchronous command there
  may only return a value already in memory.
- **Boot diagnostics get a dedicated sink, not the global logger.**
  `tauri-plugin-log` stays registered only under `cfg!(debug_assertions)`.
  Breadcrumbs are written by `apps/desktop/src-tauri/src/boot_breadcrumb.rs`,
  whose vocabulary is fixed in code: a phase outside its allowlist is
  rejected, and a detail token that is neither an outcome word nor `ms=<n>`
  is dropped. No field accepts free text, so nothing else can reach the file.
- **The file is bounded, owner-only and attributable.** It sits at
  `.goodboy/boot-breadcrumbs.log` under the home directory, mode `0600`,
  rotated whole to `.log.1` past 64 KiB, and every line carries a per-launch
  id.
- **A line's `ms` is the duration of the phase it names, written when that
  phase ends.** Files written by 0.1.80 and earlier stamped each line when its
  phase began, with the previous phase's duration, and read shifted by one
  line.
- **Process milestones come from Rust.** `process-start`, `window-created`
  and `webview-attached` are recorded before any webview code runs.
- **The window is branded before it paints.** `tauri.conf.json` declares a
  `backgroundColor` matching the document and `visible: false`, and Rust
  shows the window from `setup`, so appearing never depends on webview
  JavaScript.

## Consequences

- A command added to the boot path that does real work and is synchronous is
  a defect, however fast it looks on the author's machine.
- A user whose app fails to paint has one small file to attach to an issue,
  and its lines answer whether a given launch reached a given phase.
- Adding a phase or an outcome word means extending the allowlist in
  `boot_breadcrumb.rs`; the disclosure in [SECURITY.md](../../SECURITY.md)
  moves with it.
- The window reveal has no in-process seam, so every release checks it by
  hand ([testing.md](../testing.md) → Manual release gate).
