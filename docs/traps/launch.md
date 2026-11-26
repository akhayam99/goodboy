# Traps in launch and loading

> **Read this when** you change what the app reads at launch, the board's
> first paint, the boot order, or a drawer that loads its code on first
> open. **Not for** the boot path itself
> ([../architecture.md](../architecture.md) → Boot path) or bundle budgets
> ([../ratchets.md](../ratchets.md)).

## The first paint

### Three frames paint the same chrome

The native window, the `index.html` shell and React paint before the splash, all with the same chrome. `backgroundColor` in `tauri.conf.json` is the dark chrome (`#0d0e10`), and the shell restates the `styles.css` chrome as a literal since the stylesheet is not loaded yet; `boot-shell-paints-the-chrome.test.ts` fails until `index.html` follows a token change. The window starts hidden and `useRevealWindow` shows it after first paint; showing it in Rust setup makes light users see dark first.

### The setup wizard decides once per window

`AppOverlayRouter` mounts the wizard in two layouts, and the first session swaps layout right after Start, so a new host could read the saved state before the `done` write and reopen setup. `useOnboardingWizard` records the first open or close in `WIZARD_WINDOW_DECISION` (`OnboardingWizard/wizardWindowDecision.ts`); after that, only an explicit open event opens it. The hook test "keeps a second host closed" pins it.

## Reads at launch

### The launch reads once and hands the answers down

The order and `LaunchReads` are in [architecture.md](../architecture.md) → Boot path, and `bootBudgets.test.ts` holds each read at 1. Pass `launch` to `setCurrentWorkspace` only from the launch chain: a later switch reusing it cancels or keeps runs on a stale live set. Inside the group's `Promise.all`, `launchOrder.test.ts` pins two orders, with the restart restore and the error screen:

1. The ghost reconcile finishes before `setCurrentWorkspace` reads the agents.
2. `runDbMigrations` (which also purges step agents of deleted workflows) finishes before any member starts.

A new step that reads agents or projects goes after the group. One that writes what the workspace load reads goes into `runDbMigrations` or the group, never after ready. Prune-only hygiene goes to `runEachOnIdle` after ready.

### No query runs before the migrations of this build

`App` starts its subscriptions (the resolve drain, the Auto runtime, the polls) in the render that calls `hydrate`, before migrations finish. Without the schema gate ([architecture.md](../architecture.md) → Database migrations) the first launch after an update reads the old schema, crash capture saves the "no such table" or "no such column" rejection, and the next launch says "Goodboy hit an error last time".

Only the migration runner and its version probe use `migrationDatabase`, which never waits; elsewhere it can see the old schema, and `tauriDatabase` inside the migration path never returns. The gate covers window SQL only, not a Rust command that reads a table. Tests and the mock entry run with the gate open; a gate test closes and reopens it in `afterEach` (`dbBoot.test.ts`).

### A board fact read after the first paint moves cards

`stageInfoOf` reads only memory, so a fact loaded on session open is empty at launch and the session jumps lanes when opened. `loadWorkspaceFacts` reads every session's open questions, Not now and Auto trees inside `loadWorkspaceSnapshot`, in the same `set` as `boardReady`. A new `stageInfoOf` input is read there too, in one query for all sessions (like `listOpenQuestionsForSessions`), and counted in `loadWorkspaceFacts.sqlite.test.ts`. Resolve threads, Slack drafts and artifacts still load on open.

Only `listAutoTreesToRecover` sessions get an Auto view at load, because `autoWaitRootsOf` never waits on a resting tree. A board input that needs a resting tree's view is read there too.

### A session you did not open holds light agent rows

At launch a session without live work holds light rows in `sessionPhaseRuns` ([architecture.md](../architecture.md) → Boot path): no `outputSummary` (but the newest unread), no `domains`, no `sourceThreadIds`, no routing fields. The `Agent` type keeps them optional, so the compiler cannot tell the rows apart.

Code that may read a heavy field of an unopened session (a turn, a workflow advance, an orchestration step, any background engine) awaits `ensureFullAgents` first, as `sendTurn`, `maybeAutoAdvanceWorkflow` and `orchestrateNextStep` do. A new shell input that needs a heavy field is added to the light row and to `agent-summary.test.ts` instead.

## Code loaded on first open

### Some drawers load on first open

Many drawers, panels, forms and lenses load their code on first open so the first load stays under `bundle-budget.json`: the `Lazy*` drawers (`LazyTerminalDrawer` and the like, one status line while loading), the drawers registered with `lazyNamed` inside a `Suspense`, panels such as `WritePanel`, `PublishPanel` and `ReportStudio` (`SkeletonRows` while loading), and the Context, Activity, Files, Questions and tracker lenses from `SessionLensPane` (a lens skeleton). The Impact agents query loads from `@goodboy/db/turn-role-insight` inside `readTurnRoleInsight`, so the `@goodboy/db` root exports only types.

A test that renders one and queries at once fails on a loaded runner. Await a `findBy` query (`vi.waitFor` under fake timers; `findByTestId('context-tab')` for Context), or import the module in `beforeAll` as `b-terminal-drawer.test.tsx` and `checks-analyze.test.tsx` do. Under fake timers always import it in `beforeAll`: the first dynamic import is transformed in real time, which a fake clock never reaches.
