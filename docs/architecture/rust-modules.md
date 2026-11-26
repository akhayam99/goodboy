# Rust modules

> **Read this when** you add a file to the worktree, history or config export
> module, or name a folder a tool can rebuild. **Not for** how a git process
> starts ([git.md](git.md)) or Rust style ([rust.md](../rust.md)). The other
> pages are listed in [architecture.md](../architecture.md).

## One shape for every module

`worktree/`, `history/` and `config_export/` each live in one folder under
`apps/desktop/src-tauri/src/`, and each file owns one job.

- `mod.rs` only declares the files and re-exports their items, so callers keep
  the old paths (`crate::worktree::git`) and lib.rs registers each command by
  name (`worktree::worktree_create`, `history::history_plan_run`,
  `config_export::config_export_preview`).
- A helper another file needs is `pub(super)`; nothing else leaves its file.
- Tests sit in `<file>/tests.rs` next to the file they cover. `scratch`,
  `snapshot` and `setup_proposal` in `worktree/` keep theirs inline. Builders
  more than one group needs live in a test-only `fixtures.rs`.

## Worktree module

The Rust side of worktrees and branch reads: the folders on disk, what a folder
holds, base and branch resolution, reads and updates, a new worktree's setup
(`carry` copies ignored files over), agent fixes (`candidates`), the goodboy
directory (`scratch`, `exclude`) and the shared runner (`git`).

`worktree_list_registered` inspects many folders of one repo with a single
`git worktree list`. Opening a workspace calls it once per repo, in the
background after the first paint, and a turn start waits for that verdict for
at most five seconds.

## History module

Rewrite history and Rebase on main. `plan` resolves the steps, `predict` builds
the in-memory prediction, `trial` and `check` replay a plan in a throwaway copy,
and `journal`, `preflight` and `apply` move the branch safely, with `backups`
keeping the restore refs. lib.rs, `turn.rs` and the worktree module use its
re-exports.

- **`dirty`** holds the uncommitted work a run sets aside, in the shared stash
  ([traps.md](../traps.md#history-stashes-are-shared-across-worktrees)).
- **`live`** is the edit that runs in the worktree under its writer lease
  (`history_live_edit`).
- **`reason`** holds the codes Rust returns when it cannot read the worktree
  (`status-unreadable`, `changed-unreadable` and the like). The sentence for
  each lives in `features/history/historyReasonCopy.ts`, and `invokeHistory`
  swaps a code for its sentence at the bridge.

## Config export module

Backup and setup export ([backup.md](backup.md)). `export` builds a bundle and
lists the findings a writer can leave out, `file` writes the `0600` file,
`preview` matches a bundle to what exists, `apply` writes an import in one
transaction, and `commands` holds the four Tauri commands.
`wire_shape_tests.rs` pins the json of every bundle struct. The writer map
counts Rust writes per file, so its baseline names `config_export/apply.rs`.

## Dependency and build folders

One table, `REPRODUCIBLE_DIRS` in
`apps/desktop/src-tauri/src/reproducible_dirs.rs`, names the folders a tool can
rebuild, each with a scope.

- **`Dependency`** (`node_modules`, `__pycache__`, `.venv`, `venv`, `Pods`,
  `vendor`) counts at any depth.
- **`Output`** (`dist`, `build`, `out`, `target`, `DerivedData`, `.next`,
  `.turbo`, `.gradle`) counts at the top of a project and, for the version
  walk, at any depth.
- **`TopOnly`** (`coverage`) counts at the top of a project only.

Four readers ask it and none keeps a list of its own: the folder signals and
the saved-versions walk (`is_skipped_in_walk`), the first-commit plan
(`is_dependency` for any parent folder, `is_output_at_top` for the first one),
the detach assessment (`is_reproducible_at_top`: an ignored folder like these
is not at risk) and the script finder (`is_dependency`, plus `.git`). Add a
name there, with a test, and all four follow.
