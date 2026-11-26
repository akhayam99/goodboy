# Boot path

> **Read this when** you change what happens between launch and the first idle
> moment. **Not for** the migration runner boot calls first
> ([migrations.md](migrations.md)) or a launch trap ([traps.md](../traps.md)).
> The other pages are listed in [architecture.md](../architecture.md).

## Two rules

- **No command on the boot path blocks the UI thread.** Every Tauri command
  the boot sequence reaches that touches the database, the file system, a lock
  or a subprocess is async where it is declared
  ([ADR 002](../adr/002-boot-path-leaves-the-ui-thread.md),
  [commands.md](commands.md)).
- **The boot path starts no provider process, and `ready` says nothing about
  providers.** Providers start as `unknown` and are detected after boot,
  through one refresh entry point
  ([ADR 003](../adr/003-provider-detection-leaves-the-boot-path.md)).

## Launch order

`hydrate` (`store/slices/boot/hydrate.ts`) awaits six steps in a row
(`BOOT_BUDGETS.awaitedStepsBeforeHydrated`), and the app shows after three
(`BOOT_BUDGETS.awaitedStepsBeforeShell`).

1. Migrations. `runDbMigrations` (`shared/lib/dbBoot.ts`) also purges the step
   agents a deleted workflow left behind, with their slot questions, and seeds
   missing built-in workflows.
2. One group that runs together: the boot settings with the onboarding and the
   four settings hydrations, provider credentials, workspaces with their
   projects, the integration keys, staged file version recovery, the ghost
   reconcile and the QA preview.
3. The workspace and session restore.
4. `ready`.

The ghost reconcile reads `turn_list_live` once. That set and the projects
reach `setCurrentWorkspace` as `LaunchReads`, so the first workspace load reads
neither again. A failed member names its phase in `bootFailedPhase` on the
launch error screen.

## Shell before data

`openLaunchWorkspace` (`store/slices/boot/openLaunchWorkspace.ts`) opens the
launch workspace, whether the reload intent, the saved layout, the window hash
or the last workspace picked it.

1. It commits the shell first (`showLaunchShell`: that workspace id,
   `boardReady` false, `isShellReady` true), so `App` mounts with skeletons.
2. `setCurrentWorkspace` loads the snapshot and commits rows, cards and counts
   with `boardReady` in one set. The id is passed down, never read back after
   an await.

- **A switch during the load** claims the latest (`switchEpoch`): the launch
  load drops and the last session is not restored. The shell stays on its
  skeletons while the switch runs; if it fails, its error stays in
  `workspaceSwitchError` and the launch shell is put back.
- **A launch load that fails or does not commit** puts the shell back (id
  null, `isShellReady` false), and `openWorkspaceOrFail` throws to the launch
  error screen.

Each window runs its own chain. `isShellReady` is reset when `hydrate` starts
and set again on `ready`, so a launch with no workspace shows the launcher.
`hydrated` still means the launch is done: the layout save, the onboarding
decision, the artifact mirror and the port signal wait for it.

## What launch loads of the agents

`loadLaunchAgents` (`store/slices/workspaces/loadLaunchAgents.ts`) reads a
light row per agent (`listAgentSummariesForSessions` in
`packages/db/src/queries/agent-summary.ts`): the plain columns, with no summary
text and no JSON column (domains, thread ids, routing).

- A session with live work (an agent pending, running, blocked or stopped by
  the restart, per `needsFullAgentRows`) gets full rows at launch.
- Every other session is marked in `lightAgentSessions` and carries only the
  summary text of its newest unread agent, for the sidebar label
  (`BOOT_BUDGETS.summaryTextsPerUnopenedSessionAtLaunch`).

Opening the session replaces the light rows (`openSessionAgents`); a turn, a
workflow advance and an orchestration step load them first
(`ensureFullAgents`). The stage, the "needs you" reasons and the unread label
read only light fields, so they do not change on open.

## After ready, on idle

`runEachOnIdle` starts one task per idle slot (`waitForIdle`): ended work,
orphan worktrees, provider limits and their probe, the audit retry drain, stale
browser tabs, then `runDbHygiene` (retention pruning and orphan attachments).
None holds the one database connection before the first paint. A hygiene
failure is a warning notification, never the launch error screen. The first
pull request sweep (`sweepRequests({ isCurrentFirst: true })` from
`useGithubPolling`) refreshes the open session at once and the others on idle.

## Tests

- `bootBudgets.test.ts` holds the store commits before idle work starts.
- `store.sqlite-light-agents.test.ts` holds the light fields equal before and
  after a session opens.
