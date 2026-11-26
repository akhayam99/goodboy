# Table writers

> **Read this when** a table gets a new writer, Rust or TypeScript gains a
> write on a table, or you rename a column Rust reads. **Not for** the map of
> each table to its writer, which stays in
> [architecture.md](../architecture.md#who-writes-each-table) because a test
> reads it there. The other pages are listed in
> [architecture.md](../architecture.md).

## The rule

Each table has one writer, and the default writer is `packages/db`: the
migrations, the schema tests and the queries live there, and the frontend
reaches SQLite through them. The owner defines the columns, the migrations,
the row type and every write; the other side reads with a query that names its
columns and never writes outside a listed exception.

Rust writes a table only when the write must happen without the webview or
inside one Rust transaction: the backup export and import, a project move, the
permission audit, integration credentials, the budget checks and the work
ledger (a script run is born in a Rust process, so Rust writes its row once,
whatever the number of windows). The unit is the command or the transaction,
not the table.

- **Agent operations** stay with the agents: the routing gate, the fan-out of
  a delegated batch and the status stamps are guarded statements in
  `packages/db/src/queries/agent-write.ts`, and a workflow save is one
  transaction in `saveWorkflow`.
- **A column both sides must agree on** (a status word, a kind) is a constant
  with a twin in the other language;
  `apps/desktop/src/__tests__/regressions/rust-twin-constants.test.ts` fails
  when they differ.
- **Migrations stay in TypeScript.** Rust carries no second copy of the
  schema.

## Tables Rust reads

A rename or a dropped column in one of these changes the Rust query in the same
commit.

- **Owned by TypeScript, read by Rust:** `agents`,
  `chat_message_attachments`, `chats`, `context_slots`, `github_pr_cache`,
  `goal_attachments`, `integration_drafts`, `messages`, `mount_operations`,
  `mount_pr_links`, `open_questions`, `project_scripts`, `projects`,
  `resolve_threads`, `retained_worktree_paths`, `search_docs`, `search_index`,
  `security_findings`, `session_artifacts`, `session_external_tasks`,
  `session_workflows`, `session_worktrees`, `sessions`, `settings`, `steps`,
  `telemetry_records`, `turn_admissions`, `turn_events`, `workflows`,
  `workspace_profiles`, `workspaces`, `worktree_roots`.
- **Owned by Rust, read by Rust and TypeScript:** `browser_tabs`,
  `browser_visits`, `budget_alerts`, `budget_rules`, `integration_bindings`,
  `integration_credentials`, `permission_audit_log`, `permission_audit_retry`,
  `permission_rules`, `project_relocations`, `session_budgets`, `skills`,
  `step_library`, `work_events`.
- **Read for boot only:** `schema_version`.

## The ratchet

`packages/db/src/migrations/rust-writer-map.test.ts` reads the map and guards
both directions. Its counts only fall: remove a line when a write moves behind
its owner.

- It fails when Rust's production SQL in `apps/desktop/src-tauri/src/` gains an
  `INSERT`, `UPDATE` or `DELETE` on a `ts` table beyond its baseline.
- It fails when a query in `packages/db/src/queries/` gains one on a `rust`
  table beyond `TS_WRITES_TO_RUST_TABLES` (today `integration-binding.ts`,
  `integration-credential.ts`, `project-adoption.ts` and
  `workspace-merge.ts`). TypeScript still reaches `integration_credentials`,
  `integration_bindings`, `permission_rules` and the `permission_audit_log`
  cleanup; moving those calls behind the commands is not done yet.
- It fails on a table the map does not name, so a new table goes in the map
  first.
