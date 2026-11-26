# Backup and setup export

> **Read this when** you change what **Settings › Backup and reset** writes to
> a bundle or how an import is matched and applied. **Not for** the Rust files
> of the module ([rust-modules.md](rust-modules.md)) or Delete all data
> ([migrations.md](migrations.md)). The other pages are listed in
> [architecture.md](../architecture.md).

The page reads and writes a JSON bundle, schema version 3
(`apps/desktop/src-tauri/src/config_export/`, mirrored in
`packages/types/src/config-bundle.ts`).

## What goes in

What goes in is chosen per group (`ExportGroups`): workspaces, projects,
folder paths, profile, workflows you made, workflows the orchestrator wrote,
saved scripts, permission rules, limits, linked integrations and app
preferences. Folder paths and orchestrator-written workflows are off by
default; every other group is on.

Never included, in any bundle: API keys and tokens, sign-ins, sessions and
transcripts, artifacts, worktree folders, usage history, notifications.

- A workspace's JSON-shaped overrides (provider bindings, task models, role
  models, provider pool) carry as nested JSON values, not string-encoded text.
- The reader also accepts bundles of schema versions 1 and 2 and their `*Json`
  string fields (`LEGACY_SCHEMA_VERSIONS` and the serde aliases in
  `bundle.rs`).

## Writing a bundle

1. `config_export_preview` reports which open security findings
   (`security_findings`, see [SECURITY.md](../../SECURITY.md)) fall inside the
   selected groups.
2. `config_export_write` takes an explicit `leaveOut` list of fingerprints and
   skips that finding's subject (a script, a permission rule, a workspace's
   profile) entirely.
3. The file is written with `0600` permissions.

## Importing a bundle

Import is a read-only preview followed by an explicit apply, never one step.

1. `config_import_preview` matches each bundle workspace to an existing one by
   id, then by name. It matches each project without a folder path against
   candidate folders under a chosen parent, reusing `find_moved_projects`
   ([project-move.md](project-move.md)).
2. The preview also returns `groupStats`, a per-group adds and updates tally
   (workspaces, projects, skills, workflows, permission rules, limits, scripts,
   linked integrations), computed by checking each bundle row against the
   local database before any write. The confirm step shows what will change.
3. The caller picks, per workspace, `merge into <existing>` or
   `add as a new workspace`, and resolves a folder for projects the engine
   could not place.
4. `config_import_apply` writes the import in one transaction.

Import only inserts and updates; it never deletes a row. A project it cannot
resolve a folder for is skipped and counted, not dropped from the file.
