# Testing

> **Read this when** writing or reviewing tests: what to cover and how to
> assert. **Not for** where test files live (`docs/file-system.md`).

This file says what to test and how. Where test files go: [file-system.md](file-system.md).

## Content and rules

- 1 to 5 assertions per test, focused on behavior.
- Cover: it renders without crashing, key text / aria, 1-3 main user interactions, and edge states (loading / empty / error) if the component has them.
- Use `@testing-library/react` queries (`getByRole`, `getByText`). To check that a node is there, call `getBy*` on its own: it throws when the node is missing. To check that it is gone, write `expect(queryBy*(...)).toBeNull()`. `expect(getBy*(...)).toBeTruthy()` checks nothing the query did not already check. Write the bare call when you touch such a test, without a bulk rewrite.
- A relative `vi.mock('./x')` must point at a file that exists. A mock of a moved or deleted module mocks nothing, and the real module runs. `__tests__/regressions/relative-mocks-resolve.test.ts` fails on it.
- Do **not** test implementation details (internal state, css classes that are only for looks, prop drilling).
- For store slices: test the contract (given state X + action Y, expect state Y'), not the internals.
- For hooks: `renderHook` from `@testing-library/react`.
- Some suites have a per-test hook that dynamically `import()`s a large module graph. Such a suite loads that import once in `beforeAll`, with a timeout that fits it. Never in `beforeEach`. There, the import cost lands on whichever test runs first, and on a busy machine it goes past the 15s hook timeout in `apps/desktop/vitest.config.ts`. Never raise the global timeouts to hide it.

## Store tests share one harness

Every desktop test that loads the real store goes through `apps/desktop/src/store/storyHarness.ts`. It is the only file allowed to `import()` the store module.

- Module mocks come from the harness factories, one per mocked module: `vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock())`. A test that needs a different default overrides it on the spy for that test. It never keeps a private copy of the whole mock.
- Spies live in `storySpies`, named after the function they stand in for (`storySpies.invokeBudgetRuleList`). `resetStorySpies()` restores every default.
- The store loads once: `useAppStore = await importStore()` in `beforeAll` with `STORE_IMPORT_TIMEOUT_MS`. Then `await resetStoryStore()` runs in `beforeEach` (spies reset, `initialState` applied, local storage cleared) before the test seeds its own state.
- `__tests__/regressions/store-import-pattern.test.ts` fails on any test that `import()`s the store module itself. A test that needs another export of the store module (`summarizerQueues`) takes it from `importStoreModule()`.

## Database tests start from a migrated template

A `packages/db` test that needs a migrated schema calls `await makeMigratedTestDatabase()` (or `{ throughVersion: N }` to stop before the migration under test) from `test-helpers/test-db.ts`. The first call per version in a file runs the real migration chain once and keeps the serialized result; every call returns an independent in-memory clone with `foreign_keys` on. A migration test still runs the migration under test with a real `migrate(db)` on top of the clone. Tests whose subject is the runner itself (`runner*.test.ts`, `registry.test.ts`, segment checkpoints, crash resume, anything reading `MigrateResult` or passing a custom migration list) and file-backed databases keep `makeTestDatabase` plus `migrate`.

## Migration convergence sampling

For speed, `packages/db/src/migrations/registry.test.ts` tests a sample of the intermediate versions instead of all of them. That sample does not replace the per-version sql hash manifest checked into the same file. The manifest is what really stops anyone from editing a migration after release. The sample has its own minimum number of intermediate points it must reach. So if someone cuts the sample size, the test fails, instead of quietly shrinking to the first and last version. No test pins the sampled versions or the total number of migrations. Both change every release. A test that goes red for that reason teaches people to edit the expected values, and that is exactly how a hash manifest gets regenerated without anyone looking.

## The golden rule

If a test fails because the component / store / hook does the wrong thing, **fix the code, not the test**. Never weaken a test to make it pass.

## Manual release gate: the window must appear

`tauri.conf.json` ships the main window with `"visible": false`. The only thing
that ever shows it is the loop over `app.webview_windows()` inside `.setup()` in
`apps/desktop/src-tauri/src/lib.rs`. That loop cannot be reached from inside a
test process. It needs a real Tauri runtime, so no unit test can stand in for
it. A test that greps the source for the call checks the code's shape, not its
behavior. Every release runs this step by hand and records the result.

1. Build the bundle from the commit being checked: `pnpm tauri:build`.
2. Launch the binary directly, never through `open`, so the database override
   applies:
   `GOODBOY_DB_FILE=<path that does not exist yet> apps/desktop/src-tauri/target/release/bundle/macos/Goodboy.app/Contents/MacOS/goodboy-desktop`
3. A window must appear and paint the boot splash. If no window shows up, the
   release is blocked, however green the suites are.
4. Check that the run left a `webview-attached` line in the breadcrumb log at
   `.goodboy/boot-breadcrumbs.log` under the home directory. If the line is
   missing but the window is visible, the breadcrumb logging broke, not the
   window reveal.

## Reaching a state that only exists in memory

The orchestrator "stopping" state lives only in the store while a decision is
in progress. `orchestratingWorkflowRuns` is never persisted, because a decision
does not outlive the process that started it. So no database row you seed can
reach this state.

To see it in a real build without starting agents, put the run ids in
`GOODBOY_QA_DECIDING_RUNS` when you launch the binary:

```
GOODBOY_QA_DECIDING_RUNS=<run-id>[,<run-id>] \
  GOODBOY_DB_FILE=<path> .../Goodboy.app/Contents/MacOS/goodboy-desktop
```

At boot, those runs are marked as deciding, in memory only. Seed the operator
stop as a normal `session_workflows` row keyed by `workflow_run_id`. A
non-empty `orchestration_error` carries the message. Empty means no stop at all
(see `toStop` in `packages/db/src/queries/session-workflow.ts`). And
`orchestration_stop_kind` must be `'operator'`. That shows the plain
**Stopping** pill on the rail card and on the collapsed sidebar row. The fuller orchestrator strip needs `execution_mode = 'dynamic'`
and the sidebar row expanded. The plain pill then hides itself and the strip
shows instead. Nothing is written back. Relaunch without the variable and it
shows **Stopped** again. Never persist the in-flight flag.
