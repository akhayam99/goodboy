# File access from commands

> **Read this when** a Tauri command reads, writes or deletes a file the window
> names, or accepts a dropped file. **Not for** the diff's file sides
> ([git.md](git.md)) or the folders the app keeps for itself
> ([data-layout.md](data-layout.md)). The other pages are listed in
> [architecture.md](../architecture.md).

## Paths under a root

A command that reads or deletes a file under a root uses
`apps/desktop/src-tauri/src/util/scoped_path.rs`.

- **`resolve_within`** returns the canonical path of a file below a root. It
  refuses a relative root, a `..` component and a path or symlink that resolves
  outside the root.
- **`open_within`** also walks the path with `openat` and `O_NOFOLLOW`, so a
  file swapped for a symlink after the check is refused. This is unix only;
  other platforms refuse, and `open_file_within` falls back to
  `resolve_within` where an attachment must still work.

`local_image_read`, `attachment_read`, `attachment_write`,
`attachment_delete`, `explore_*` and the single-file diff all go through it. A
new command that takes a path must too.

## Dropped files

`attachment_read_dropped` accepts only a path the window reported in a drag
drop event.

1. The Rust shell records the paths of each `DragDrop` drop
   (`dropped_paths.rs`). `on_window_event` hears the window page, which reports
   a drop as a window event, and `on_webview_event` hears a child webview such
   as a browser tab.
2. In that same handler it opens each dropped regular file and keeps the
   handle, at most 64, so a screenshot tool that deletes or moves its temporary
   file once the drag ends cannot take the bytes away.
3. The read goes through the held handle. A path that failed to open at the
   drop is opened once more at the read.
4. The first read removes the path.

The answers:

- `not_dropped`: the path was never dropped, or was dropped once and already
  read.
- `gone`: the file is gone at both moments.
- `denied`: the user may not read it.
- `invalid_path`: a folder.

## Removing folders

- `session_dir_remove` takes the session id and removes a directory only when
  it is a direct child of a `sessions` folder (or a mount inside one) whose
  `.goodboy` marker names that session, and never through a symlink.
- `worktree_scratch_remove` takes only a direct child of the temp folder named
  `goodboy-check-*`.

No `skill_*` command exists: the Skills feature and its script runner are
deleted, and `check-tauri-commands.mjs` fails if one comes back.
