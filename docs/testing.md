# Testing

> **Read this when** writing or reviewing tests: what to cover and how to
> assert. **Not for** where test files live (`docs/file-system.md`).

This file says what to test and how. Where test files go: [file-system.md](file-system.md).

## Content and rules

- Every vitest config caps a local run at two workers (`maxWorkers`), so an agent that runs the suite does not fill the machine's memory. CI sets `CI` and keeps the vitest default. A flag such as `--maxWorkers=4` still overrides the cap for one run.
- 1 to 5 assertions per test, focused on behavior.
- Cover: it renders without crashing, key text / aria, 1-3 main user interactions, and edge states (loading / empty / error) if the component has them.
- Use `@testing-library/react` queries (`getByRole`, `getByText`). To check that a node is there, call `getBy*` on its own: it throws when the node is missing. To check that it is gone, write `expect(queryBy*(...)).toBeNull()`. `expect(getBy*(...)).toBeTruthy()`, `.toBeDefined()` and `.not.toBeNull()` check nothing the query did not already check. Write the bare call when you touch such a test. `truthy-queries.test.ts` below counts what is left and never lets it grow.
- `__tests__/regressions/` holds grep checks over the source tree. `forbidden-patterns.test.ts` compares per-file counts of the AGENTS.md forbidden patterns with `forbidden-patterns.baseline.json`. It fails when a file grows or a new file has any. A change that removes occurrences regenerates the baseline in the same commit, with `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/forbidden-patterns.test.ts`. Never regenerate it to absorb new occurrences. Migrations are append-only, so their rows stay.
- `__tests__/regressions/escape-and-keys-use-the-stack.test.ts` counts `'Escape'` literals and `window` or `document` keydown listeners in product code, per file, against `escape-and-keys-use-the-stack.baseline.json`. `packages/ui/src/escape.ts` and `shared/keyboard/dispatcher.ts` are exempt, and so is `shared/keyboard/registry.ts` for the `'Escape'` literal alone, because the registry names the Esc key of the selection group for the help page while the escape stack still does the work. A count may fall and never grow, and a new file starts at zero. Esc goes through `useEscapeLayer` and a shortcut through the registry with `useShortcut`. When a change removes handlers, regenerate the baseline in the same commit: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/escape-and-keys-use-the-stack.test.ts`. Never regenerate it to absorb a new handler.
- `__tests__/regressions/time-formatting-goes-through-the-module.test.ts` counts `toLocaleTimeString`, `toLocaleDateString`, `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` in product code, per file, against `time-formatting-goes-through-the-module.baseline.json`. `shared/utils/time/formatIntl.ts` is exempt. A count may fall and never grow. A test of a date, time or age formatter pins the zone with `usePinnedTimeZone` (`src/test/usePinnedTimeZone.ts`) and never reads the machine zone. Regenerate the baseline only when a change removes call sites: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/time-formatting-goes-through-the-module.test.ts`.
- `__tests__/regressions/copy-budget.test.ts` reads the text a person sees (JSX text and copy properties under `features/`, `app/components/` and `shared/components/`, through the walker in `scanCopy.ts`) and counts, per file, against `copy-budget.baseline.json`: a `description`, `hint`, `help`, `meta` or `body` over 13 words, a position phrase ("shows up here", "above", "below"), first person in a copy property, a sentence that opens in lowercase, and each retired word of `RETIRED_NAMES` in `shared/utils/names.ts`. A count may fall and never grow, and a new file starts at zero. A change that cuts copy does not touch the baseline: the owner of the release regenerates the file once, with `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/copy-budget.test.ts`. `jargon-copy.test.ts` shares the walker and works the same way. When the release closes the ratchet, run both with `RATCHET_CLOSE=1` to fail on any baseline entry above its measured count, then regenerate. `settingsDirectory.test.ts` holds the Settings rail rows to 24 characters and no period.
- `website/scripts/site-copy.test.mjs` is the copy guard of the website, a node test that runs with `pnpm test` in `website/`. It reads the text a visitor sees (JSX text, string literals and the copy keys of the data files under `website/src`, through `website/scripts/lib/siteCopy.mjs`) and counts, per file, against `website/scripts/site-copy.baseline.json`: each retired name of `retiredNames.ts` (the test reads the patterns out of that file, so the app and the site share one list) and each em or en dash. A count may fall and never grow, and a new file starts at zero. `RATCHET_CLOSE=1` fails on any baseline row above its measured count, and `GOODBOY_UPDATE_BASELINE=1 node --test scripts/site-copy.test.mjs` regenerates the file and refuses to raise it. The test has no list of hype words, because that list belongs to the owner.
- A relative `vi.mock('./x')` must point at a file that exists. A mock of a moved or deleted module mocks nothing, and the real module runs. `__tests__/regressions/relative-mocks-resolve.test.ts` fails on it.
- A rule that lives in both TypeScript and Rust is pinned by one JSON fixture that both test suites read. The slug rule uses `packages/core/src/slug/slug.fixture.json`: `slug.test.ts` and the `worktree/slug/tests.rs` tests assert the same input to output rows. Change a row in the fixture, never in one side.
- No DOM snapshots: a serialized tree pins every class and breaks on a dependency bump without catching a bug. Assert roles, text and ARIA, and drive the interaction. A snapshot is for text a person reads in review, such as a prompt or a table of defaults, and a prompt goes to a file with `toMatchFileSnapshot`.
- Do **not** test implementation details (internal state, css classes that are only for looks, prop drilling).
- For store slices: test the contract (given state X + action Y, expect state Y'), not the internals.
- For hooks: `renderHook` from `@testing-library/react`.
- Some suites have a per-test hook that dynamically `import()`s a large module graph. Such a suite loads that import once in `beforeAll`, with a timeout that fits it. Never in `beforeEach`. There, the import cost lands on whichever test runs first, and on a busy machine it goes past the 15s hook timeout in `apps/desktop/vitest.config.ts`. Never raise the global timeouts to hide it.
- `__tests__/regressions/store-mocks.test.ts` counts the `vi.mock` and `vi.doMock` calls in `apps/desktop/src` whose target resolves to `store/store`, `store/index`, the `store` folder or a module under `store/slices/`, per file, against `store-mocks.baseline.json`. A mock of another module that only has `store` in its name (`onboardingSettings`) is not counted. A file may keep what it has or shed it, and a new file starts at zero. It is a static scan and runs in well under a second. Regenerate the baseline only on the integration branch, with `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/store-mocks.test.ts`, so that parallel changes do not edit the same rows. Never regenerate it to absorb a new mock.
- `__tests__/regressions/static-store-imports.test.ts` counts a value import of the store (`store`, `store/store`, `store/index`) in a desktop test file, per file, against `static-store-imports.baseline.json`. A static import skips the `beforeAll` budget and the per-test reset; load the store with `importStore()` instead. A type-only import is not counted.
- `__tests__/regressions/hand-written-tauri-mocks.test.ts` counts, per file, a `vi.mock` or `vi.doMock` of `@tauri-apps/api/core` and of `@goodboy/db` whose factory is written in the test and does not come from `storyHarness`, against `hand-written-tauri-mocks.baseline.json` and `hand-written-db-mocks.baseline.json`. A hand-written factory answers `undefined` for a command it forgot, and the unexpected-call guard never sees it. Use `tauriCoreModuleMock()` and `dbModuleMock({ ...stubs })`. For both guards a count may fall and never grow, a new file starts at zero, and the baselines regenerate as the other ones do (`GOODBOY_UPDATE_BASELINE=1`, on the integration branch).
- `__tests__/regressions/truthy-queries.test.ts` counts `expect(getBy*(...)).toBeTruthy()` and `getAllBy*` in `apps/desktop` test files, per file, against `truthy-queries.baseline.json`. A second count in the same file reads `.toBeDefined()`, `.not.toBeNull()` and `.not.toBeUndefined()` on the same queries in the desktop and package tests, against `truthy-queries.defined.baseline.json`. The query throws when the node is missing, so the assertion adds nothing. A count may fall and never grow, and a new file starts at zero. Regenerate the baseline when a change removes occurrences: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/truthy-queries.test.ts`.
- `__tests__/regressions/class-assertions.test.ts` counts `toHaveClass`, `classList.contains` and `className` or `class` attribute checks in `apps/desktop` test files, per file, against `class-assertions.baseline.json`. A class pins the look, not the behavior, and the class contract belongs to `packages/ui`. A count may fall and never grow, and a new file starts at zero. Regenerate it the same way with `src/__tests__/regressions/class-assertions.test.ts` when a change removes assertions.
- `__tests__/regressions/rust-spawn-sites.test.ts` counts `.spawn()` and `.kill()` in the Rust sources under `apps/desktop/src-tauri/src`, outside `proc/`, per file, against `rust-spawn-sites.baseline.json`. Comment lines and the trailing test module of a file are not counted. A count may fall and never grow, and a new file starts at zero. A process is started and stopped through `proc/` (`docs/architecture.md`, Processes Goodboy starts). Regenerate the baseline when a change removes call sites: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/rust-spawn-sites.test.ts`.

Rust history tests reserve copies in their isolated temporary test root, so a real-Git test never touches the application's live reservations.

## Rules for every change

These hold for each change that touches a test, and they come from tests that stayed green while the app was wrong.

1. A bug fix starts from a test that fails on the old code. The PR body names that test.
2. Assert behavior: role, text, aria, or the state of the store or the database after an action. Never a CSS class in `apps/desktop`, never `expect(getBy*(...)).toBeTruthy()`.
3. A new test does not fake the store. It loads the real one through `storyHarness` (`importStore`, `resetStoryStore`, `stubStoryInvoke`). A file whose assertions you change moves to the harness in the same change. A file that only sits next to your change stays as it is. `store-mocks.test.ts` fails on any file that mocks the store beyond its baseline.
4. A mock scene proves that a surface mounts with no console error and no error boundary, in both themes, and nothing more. A scene test that must see the scene's own IPC answers mocks `@tauri-apps/api/core` with `sceneInvoke` (`src/test/sceneInvoke.ts`), which forwards to the `mockIPC` bridge the scene installed, because an `invoke` that never answers hides a crash the browser shows. A scene with clickable writes installs `installSceneDatabase` and `installScenePlanEngine` ([mock-screenshots.md](./mock-screenshots.md)), and its test clicks the real controls. Behavior is proved in harness tests, and geometry by capturing the scene and looking at it. Add a scene with [recipes/mock-scene.md](recipes/mock-scene.md).
5. Delete a test that only checks that a fake function was called, one that repeats a ratchet, and one for text you removed.
6. No new real wait with `setTimeout`. Use fake timers or wait on the condition. `no-real-wait.test.ts` counts a promise that resolves on a `setTimeout` per file, skips a file that uses fake timers, and only falls. `no-wall-clock-in-unit.test.ts` counts a clock read compared with a budget in a file that is not `*.perf.test.ts`, and only falls. `no-skipped-tests.test.ts` fails on any skipped, focused or todo test, with no baseline.
7. New behavior goes in a new test file beside the old one. The huge files (`buildTimelineStream/index.test.ts`, `orchestrateNextStep.test.ts`) only get shorter: `file-lines.test.ts` keeps every test file past 1,000 lines in `test-file-lines.baseline.json` and fails when one grows or a new one crosses it.
8. The PR body says "tests removed n, replaced by m, files converted k".
9. A ratchet baseline never grows. `pnpm run check:baselines` fails on growth, and only the owner lists an exception: [ratchets.md](ratchets.md).
10. A layout claim (width, position, which column) is proved by geometry in a scene probe (`scripts/validate-scenes.mjs`), never by `data-width` or a class in a test. `no-layout-by-attribute.test.ts` counts the claims left in `__tests__/surfaces` and, in `no-layout-by-attribute.elsewhere.baseline.json`, in every other desktop and package test, and only falls.
11. A control that starts async work is `disabled` or `isBusy` and says why in a tooltip ("Wait for the turn to finish"), or runs through `usePendingAction`. `busy-controls.test.ts` counts the ones left. A ternary with two identical branches fails the same guard.
12. A page's close control is named from its title: `StudioShell` builds `Close <title>` unless `closeLabel` is given. `retiredNames.ts` matches a former name in any casing, `aria-label` and `title` included.

## Conversion verdicts

A file that fakes the store gets one verdict before anything is deleted: keep (it proves behavior a fake cannot hide), convert (same claims on the real store, call-only assertions replaced by state) or delete (it only checks that a fake was called). A domain moves one at a time and its table lives here. A relative `vi.mock` of an own module is counted for information only and is never banned.

| Domain               | File                                                                       | Verdict                                            |
| -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| `features/workspace` | `GoodboyIgnoreCard/index.test.tsx`                                         | converted: real save, error and retry              |
| `features/workspace` | `LocateMovedProjects/index.test.tsx`                                       | converted: real row, move, error and retry, cancel |
| `features/workspace` | `WorkspaceIdentityRow/index.test.tsx`                                      | converted: real selectors over seeded workspaces   |
| `features/workspace` | `WorkspaceSwitcher/CurrentWorkspaceRow.test.tsx`                           | converted: real live-work count                    |
| `features/workspace` | `hooks/useProjectGitStatuses/index.test.ts`                                | converted: real store, git status over the invoke  |
| `features/workspace` | `StageBoard/useBoardNavigation/index.test.ts`                              | converted: real navigation stack and editor invoke |
| `features/workspace` | `StageBoard` (three files), `WorkspaceLauncher`, `WorkspaceSwitcher/index` | convert, open                                      |

## Preservation tests map onto navigation rows

Twelve files kept a claim from a release migration: each `it()` says a capability still has a home. A file that lists capabilities has no source document in the repository, so each `it()` is judged against `__tests__/surfaces/navigation-flows` (`*.rows.tsx`, with `harness tests` as the other home). An `it()` that a row proves on the same control is deleted. One that a row only reaches, without asserting what the `it()` asserts, stays under a title that names the domain, never a release or a sprint. The first pass removed 7 tests, replaced by 7 rows:

| Removed `it()`                                            | Row that proves it                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| session tools: the Context row opens the Context drawer   | `palette-destinations`: context drawer from the session tools                       |
| Sessions page: Archived lane keeps Restore                | `board-lanes`: Archived stays in view and Restore sends its first card to its stage |
| Tasks issue pane: Start session on an issue nobody linked | `start-paths`: Tasks issue Start opens the New session draft with the issue above   |
| New session: Start a run from the Overview New menu       | `create-and-search`: overview New opens its menu, and Start a run opens the field   |
| New session: Report and Wireframe drawer forms            | `create-and-search`: new drawer, write report and write wireframe                   |
| Agent page: View transcript opens the transcript pane     | `headers`: agent page, View transcript opens the transcript pane                    |
| Branch page: Comments entry keeps its groups              | `branch-page`: worktree level, the Comments entry opens the Branch on its Comments  |

A file name or a baseline key that still says `preservation` moves with its baseline in the PR that owns the ratchet, never here.

## Desktop unit tests run in four shards

CI splits the desktop `unit` project with `vitest run --project unit --shard=i/4`. Vitest sorts the files by the hash of their path and cuts the list into four equal slices, so adding or removing a test file can move other files to a different shard. To reproduce one CI job locally: `pnpm --filter @goodboy/desktop exec vitest run --project unit --shard=2/4`. `node scripts/check-test-shards.mjs` runs in the `checks` job. Coverage holds by construction, so it guards an empty shard and a custom sequencer that drops or repeats a file.

## Test environment

`apps/desktop/vitest.config.ts` runs every file under happy-dom. A file that never reads a DOM global, directly or through the modules it imports (`window`, `document`, `localStorage`, `navigator`, `requestAnimationFrame` and the like), starts with `// @vitest-environment node`, which skips the DOM setup and cuts the file's cost by about a third. The docblock is the only comment a test file may carry. Node is never the default: product code that guards on `typeof window` would take its fallback path under node and stay green, so a forgotten docblock must cost time, never correctness. A new file starts on happy-dom, and gets the docblock only when it is pure logic. A file that fails under node with `document is not defined` or `window is not defined` stays on happy-dom.

## The boot module is a global double

`apps/desktop/src/shared/lib/dbBoot.ts` runs the migrations, restores a snapshot and wipes the database at launch. It is the only desktop module that imports `@goodboy/db/migrations`, which pulls the 200-odd migration files, and `__tests__/regressions/migrations-boot-only.test.ts` keeps it that way. `src/test/dbBootDouble.ts` is a vitest setup file that replaces it with no-op spies for every test, so a test that only reaches it through the store never loads the migrations. A test that drives boot itself replaces the double with `dbBootModuleMock()` from `store/storyHarness.ts`. `shared/lib/dbBoot.test.ts` loads the real module with `vi.importActual` over an in-memory database, and covers a fresh boot, a repeat boot, a database from a newer build and a wipe. A test that needs a migrated schema imports `migrate` from `@goodboy/db/migrations`, never from the `@goodboy/db` root.

Vitest runs with `silent: 'passed-only'`: the stdout of a passing test is dropped and the stdout of a failing one is kept. `console.error` and `console.warn` never reach stdout anyway, the guard below catches them.

## Console output fails the test

An unexpected `console.error` or `console.warn` fails the test that produced it. `apps/desktop/src/test/failOnConsole.ts` is a vitest setup file. At import it replaces both channels with a recorder, and `afterEach` throws unless every recorded message is in `apps/desktop/src/test/console-baseline.json`. An `afterAll` does the same for output from `beforeAll`, `afterAll` or a timer that fires after the last test. A test that spies on the console itself (`vi.spyOn(console, 'error')`) handles its own output. A spy that only counts or collects must forward the lines it does not expect to the original it captured (`const logError = console.error`), or it silences the guard.

- The baseline lists what the suite already printed when the guard landed: one entry per test file and message, with uuids and digits collapsed to `#` (an HTTP status code before a status word stays). The message is its first line, or its first two lines for a React format-string warning, so a new "unique key" warning in a baselined file does not hide under the old one. It is a ratchet, like `forbidden-patterns.baseline.json`: `__tests__/regressions/console-baseline.test.ts` pins the entry count in `BASELINE_CEILING` and a hash of the entries in `BASELINE_SHA256`, so swapping an entry fails too. Never add an entry to silence output you introduced. Fix the cause: complete the mock, stabilize the hook input, fix the invalid DOM nesting.
- A test that exercises an error path on purpose spies on the console and asserts the message. That is the alternative to a baseline entry. `packages/core` tests do this for every expected `console.warn`.
- Output that arrives from a timer after its test ended lands in the next test of the same file, or in the `afterAll` for the last one. A late timer can therefore fail an innocent neighbour: stop the timer in the test that starts it.
- To shrink it, fix the cause, then run the affected files with `GOODBOY_UPDATE_CONSOLE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run <path> --maxWorkers=2`. The run rewrites the entries of the files it ran and refuses to add a new one. Update the two constants in `console-baseline.test.ts` in the same commit. Three traps: an update run with `-t` (a test name filter) runs part of a file and drops the entries of the tests it skipped; two update runs in parallel overwrite each other; `GOODBOY_CONSOLE_REPORT` alone is refused, the guard would be off. `GOODBOY_SEED_CONSOLE_BASELINE=1` is the one switch that lets an update run add entries, and it never removes any: use it only to seed.
- A mock that throws inside code that catches it prints through `console.error` and lands on this guard. The catch swallows the throw, the console line does not. The shared db and invoke mocks below no longer throw: they record the call and fail the test in `afterEach`.
- `__tests__/regressions/console-guard.test.ts` runs fixtures through the real setup file. `console-guard-wiring.test.ts` (unit project) and `a11y/console-guard-wiring.test.ts` check that `console.error` carries the guard marker, so dropping `setupFiles` or `extends: true` from `vitest.config.ts` goes red.
- `packages/ui` and `packages/core` load their own strict `src/test/failOnConsole.ts` (no baseline: any console output fails). Their vitest config lists it in `setupFiles`.

## Store tests share one harness

Every desktop test that loads the real store goes through `apps/desktop/src/test/storyHarness/` (`store/storyHarness.ts` re-exports it for one release). `spies.ts` is the only file allowed to `import()` the store module; the factories live in `moduleMocks.ts`, the db stubs in `dbStubs.ts` and the builders in `builders.ts`.

- Mock the Tauri boundary; a module mock of our own packages comes only from the harness factories, one per mocked module: `vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock())`. A test that needs a different default overrides it on the spy for that test, or passes its own stubs: `dbModuleMock({ listContextSlotsForSession: mine })` adds them over `storyDbStubs()`. It never keeps a private copy of the whole mock. The permission and plan modules are in the same set: `storySpies.invokePermissionRuleList`, `storySpies.invokeAuditRetryDrain`, `storySpies.upsertPlan` and the rest are the spies behind `permissionsModuleMock()` and `plansModuleMock()`. `tauriInvoke` answers the commands in `storyInvokeHandlers`; `stubStoryInvoke` adds or replaces one for a test.
- Spies live in `storySpies`, named after the function they stand in for (`storySpies.invokeBudgetRuleList`). `resetStorySpies()` restores every default.
- The store loads once: `useAppStore = await importStore()` in `beforeAll` with `STORE_IMPORT_TIMEOUT_MS`. Then `await resetStoryStore()` runs in `beforeEach` (spies reset, `initialState` applied, every store action a test or scene replaced restored to the one the store was built with, local storage cleared) before the test seeds its own state. A scene seed that stubs `navigate` therefore cannot leak into the next scene of the same file.
- `__tests__/regressions/store-import-pattern.test.ts` fails on any test that `import()`s the store module itself. A test that needs another export of the store module (`summarizerQueues`) takes it from `importStoreModule()`.

### Store on a real sqlite

A test that must prove what the store writes runs on the real `@goodboy/db` over an in-memory migrated database. It is named `store.sqlite-<area>.test.ts` (or `<slice>.sqlite.test.ts`) and is for integration questions only: what rows an action leaves behind, and whether a write that fails halfway leaves the rows and the store consistent. Behavior that does not need rows stays on `dbModuleMock()`.

- Do not mock `@goodboy/db`. Mock `../shared/lib/db` with `sqliteDbLibModuleMock()` instead, and take every other module mock from the harness as usual. `await resetStoryStore()` then `await openStorySqlite()` in `beforeEach` give each test a fresh database (a clone of the migrated template). Seed rows with the real `insertWorkspace`, `insertProject` and the like, or through the store action under test.
- Read rows back with `rowsOf({ sql, params })`. `storySqlite()` is the database itself.
- `injectDbFault({ match, message, skip })` arms a one-shot failure for the next statement whose SQL matches `match` (`skip` lets the first n matches through). On a plain `execute`, `select` or `exec` it throws before the statement runs. Inside `transaction` it swaps that statement for one the database rejects, so the statements before it run and the real rollback undoes them: a test that expects "no half rows" tests the transaction, not the mock.
- Writes of agents and workflow definitions (`invokeAgentInsert`, `invokeWorkflowUpsert`) are `@goodboy/db` functions (`insertAgent`, `saveWorkflow`), so their behavior is tested in `packages/db/src/queries/agent-write.test.ts` and `workflow-save.test.ts`. The harness keeps them as spies; a sqlite test that needs the rows calls the real function from the spy: `storySpies.invokeAgentInsert.mockImplementation((run) => insertAgent(storySqlite(), run))`.
- `store.sqlite-turn.test.ts` drives `sendTurn` on this database: cancel, retry and cleanup leave the rows it asserts. The session summarizer writes its own `provider_runs` row after a turn, without a `routingDecision`, so a test that counts a turn's runs filters on that key and an `afterEach` waits for `summarizerQueues` to empty before the next database replaces the first.
- `apps/desktop/src/__tests__/journeys/<name>.sqlite.test.tsx` holds the A1 journeys, one file per flow: start a session from an issue, Auto delegates and a child finishes, an orchestrated run to completion, a preset run advanced by hand, remove a merged worktree from Next. A journey is stateful: it drives every transition through the real store over the migrated database, mocks only the provider IPC, renders the screen that shows the state where one exists, and asserts each step between the start and the end, not only the last one. The shared setup (`stubProviderRouting`, `bindAgentRowsToSqlite`, `createHeldTurns`) is in `__tests__/helpers/journeyHarness.ts`.
- After a fault, assert both sides: the rows through `rowsOf` and the store through `useAppStore.getState()`. Break the code once on purpose (drop the transaction, drop the store rollback) and see the test go red.

## Test data comes from the builders

A test that needs a `Session`, `Agent`, `Project`, `Workspace` or `WorkflowRun` calls `aSession`, `anAgent`, `aProject`, `aWorkspace` or `aWorkflowRun` from `@goodboy/types/testing` (`packages/types/src/testing/`) and overrides only the fields it asserts on: `aSession({ goal: 'Reconcile the Harborline ledger export', autoRun: true })`. Every builder returns the whole type, so no field is `undefined` for a guard to skip, and each call gets its own id. Ids are branded strings: pass `'session-1' as SessionId` when a test needs a known one. `buildStorySession`, `buildStoryAgent`, `buildStoryProject` and `buildStoryWorkspace` in `store/storyHarness.ts` delegate to them and only set their own defaults. Never write a local `makeSession` that returns a partial object, and never cast one (`{ id } as Session`, `as unknown as Session`): the compiler stops checking the fixture and the code under test reads a field that was never there.

- `__tests__/regressions/test-casts.test.ts` counts `as unknown as`, `as never`, `as any` and `as Session|Agent|Project|Workspace|WorkflowRun` in test files, `storyHarness.ts`, `src/test/` and the `testing` and `test-helpers` folders, per file, against `test-casts.baseline.json`. A count may fall and never grow, and a new file starts at zero. When a change removes casts, regenerate the baseline in the same commit: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/test-casts.test.ts`. Never regenerate it to absorb a new cast. Convert a file's casts to builders when you touch the file.
- The same test fails when product code imports `@goodboy/types/testing`.
- A fake of the store or a hook result that stays partial is typed with `satisfies Pick<AppStore, 'sessions'>`, never `as unknown as AppStore`.
- A builder for `Notification` belongs with the `@goodboy/db` test helpers, because its type lives in `@goodboy/db` and `@goodboy/types` cannot depend on it. None exists yet.

## Unstubbed calls fail the test

`createDbMock(stubs)` in `apps/desktop/src/test/dbMock.ts` builds the mock of `@goodboy/db` from the real module: every export of the package is on it. A function you did not stub records its call (name and arguments) and returns an inert value (`[]` for `list*`, `null` for `get*` and `find*`, `0` for `count*`, `false` for `has*`). Constants and classes of the real module stay real. A stub whose name the package no longer exports throws when the mock is built, so a rename shows up at once.

`createInvokeMock({ handlers, unknownResult })` in `src/test/invokeMock.ts` does the same for Tauri commands: a command with no handler records its name and payload and resolves to `unknownResult`. It never throws, because a throw becomes an unhandled rejection in the fire-and-forget code that calls `invoke`.

`src/test/failOnUnexpectedCalls.ts` is a setup file. It clears the record before each test and throws in `afterEach` when the record is not empty, naming every call. The record exists because the product code often catches the error a missing stub used to raise, so the console alone cannot see it.

- Fix a hit by stubbing the call with the value the real code returns: `storyDbStubs()` in `test/storyHarness/` for a db function every store test needs, `stubStoryInvoke({ command: value })` for a command one test needs, a local stub for one test. Do not stub it with `undefined` to make the message go away.
- A test that makes the call on purpose reads the record with `drainUnexpectedCalls()` and asserts it. That empties it, so the guard passes.
- No test that loads the real store keeps a hand-written db mock. A slice test that fakes the store and needs its own db mock still builds it with `createDbMock({ ...own })` (or `createDbMock({ ...storyDbStubs(), ...own })`), so the calls it forgot are recorded and a stub for a name the package dropped fails the file at load.
- A test that reaches an error path on purpose spies on `console.warn` or `console.error`, keeps the lines it expects and forwards the rest (`const logWarn = console.warn`), then asserts what it kept. That is how `store.summarizer-notifications.test.ts` and `artifactScoutRun.test.ts` stay out of the console baseline.
- `__tests__/regressions/console-guard.test.ts` runs a fixture through the real setup file and checks that an unstubbed db call and an unstubbed command fail their test.

## Accessibility suite

`apps/desktop/src/__tests__/a11y/` runs as its own vitest project: `pnpm --filter @goodboy/desktop test:a11y` (CI job `packages tests + a11y`, blocking). `pnpm test` skips it to stay fast.

- Every case calls `expectBaseline({ name, container })`, which runs axe and compares the sorted violation ids to `A11Y_BASELINE` in `baseline.ts`. A new violation fails; a fixed one also fails until its id is deleted from the baseline. The baseline only shrinks: never add an entry to silence a violation you introduced. Delete the file when it is empty.
- `scenes.test.tsx` renders every entry of `MOCK_SCENES` (the tracked registry in `app/components/MockScene/index.tsx`) with a fresh store and a Tauri bridge that never answers, so a new scene is scanned the day it is registered. Timers are fake while the scene mounts: the test advances them until the scene's scripted clicks and reveals have run, then restores real timers before axe, so no scene timer mutates the DOM mid-scan and the result is the same in isolation, filtered, or in the full run.
- Seeds follow the mock vocabulary (Harborline, Northwind, ledger-core, payments-api), never real names.
- happy-dom has no layout, so axe reports `color-contrast` as incomplete, never as a violation. Contrast belongs to the token contrast guard (`__tests__/regressions/token-contrast-floor.test.ts`); this suite covers structure only, in either theme.

## Every page has a navigation flow row

The `apps/desktop/src/__tests__/surfaces/navigation-flows/` folder mounts the whole `App` on the real store, with only the Tauri bridge mocked. Each row of its tables clicks a real control (crumb menu, palette, footer, settings rail, mount row, back arrow) and checks that a heading or landmark of the destination renders. A row fails on React #185, "Maximum update depth", "getSnapshot should be cached", the error boundary, or a store action it lists in `covers` that the click never called.

The `target-identity` rows are the template for "view mount A, act on mount B": open mount A, trigger an action that names mount B, and assert that B is the mount shown or written (`docs/typescript/state-writes.md`).

`__tests__/surfaces/one-home.test.tsx` guards the "one home per thing" rule of `docs/navigation/model.md`. It renders the board, the linked-work row and the providers menu from the mock scene seeds, on the real store, and fails when the workspace name shows outside the top bar, a task id shows twice in one row, a stage default (`no PR yet`, `awaiting review`) is given as a reason, or a limit figure shows twice in the providers menu. When a scene seed changes, change the test with it.

- The rows live in the `*.rows.tsx` files of the folder, one per group of controls; each has a `*.test.tsx` twin that runs them, so the suite splits across workers. The ratchet finds every `*.rows.tsx` in the folder and fails when one has no twin that calls `runNavigationRows`. `harness.tsx` holds the bridge mock, `boot` and the click helpers. A new page, studio, lens, settings section or navigation action adds one row to the group it belongs to, in the same commit.
- `ratchet.test.tsx` greps the store navigation actions (`open*`, `navigate`, `back`, `forward`, `goToHistory`), the `useAppOverlays` openers, the studio kinds, the settings scopes and sections, and reads the live crumb menu and palette. Anything without a row fails the test. `EXEMPT` holds the few actions that open no page, each with its reason; an entry there that gains a row, or whose action is gone, fails too.

## Database tests start from a migrated template

A `packages/db` test that needs a migrated schema calls `await makeMigratedTestDatabase()` (or `{ throughVersion: N }` to stop before the migration under test) from `test-helpers/test-db.ts`. The first call per version in a file runs the real migration chain once and keeps the serialized result; every call returns an independent in-memory clone with `foreign_keys` on. A migration test still runs the migration under test with a real `migrate(db)` on top of the clone. Tests whose subject is the runner itself (`runner*.test.ts`, `registry.test.ts`, segment checkpoints, crash resume, anything reading `MigrateResult` or passing a custom migration list) and file-backed databases keep `makeTestDatabase` plus `migrate`.

## Migration convergence sampling

For speed, `packages/db/src/migrations/registry.test.ts` tests a sample of the intermediate versions instead of all of them. That sample does not replace the per-version sql hash manifest checked into the same file. The manifest is what really stops anyone from editing a migration after release. The sample has its own minimum number of intermediate points it must reach. So if someone cuts the sample size, the test fails, instead of quietly shrinking to the first and last version. No test pins the sampled versions or the total number of migrations. Both change every release. A test that goes red for that reason teaches people to edit the expected values, and that is exactly how a hash manifest gets regenerated without anyone looking.

Rust repository fixtures reserve a unique directory before Git initialization.
Timestamp-only names can collide in parallel tests. The helper in
`apps/desktop/src-tauri/src/worktree/file_sides/tests.rs` combines a per-process
counter with a timestamp and uses `create_dir` to reject reuse.

## Fake CLI binaries for the Rust spawn tests

`apps/desktop/src-tauri/tests/fixtures/fake-cli/` holds POSIX `sh` scripts named `claude`, `codex`, `cursor-agent`, `agy`, `copilot` and `opencode`, plus `streams/` with one recorded output per provider. The Rust tests copy the folder to a temp dir with `FakeCli::stage(mode)` (`src/fake_cli.rs`) and start the copy through the real code: `spawn_one` in `turn.rs` for a turn, `run_planner` and `run_summarize` for the side jobs, `detect_binary_within` and the `check_*_auth_with` functions in `providers.rs` for detection and sign-in. The tests live in `src/turn/fake_cli_tests.rs`, `src/providers/fake_cli_tests.rs` and `src/providers/cli_args/fake_cli_tests.rs`, and run under plain `cargo test --locked`.

- The `mode` file next to the scripts picks the behavior: `ok` replays the recorded stream, `fail` exits 3 with stderr, `flood` writes 300 KiB to stderr first, `hang` sleeps until it is cancelled, `partial`, `binary` and `silent` cover the odd endings, and the version and sign-in modes cover detection.
- A script writes its argv and a fixed list of env vars to `fake-cli-argv.txt` and `fake-cli-env.txt` in its working dir. A test asserts on those, so it sees what the child really got.
- The scripts keep the executable bit in git and use only POSIX `sh`, `cat`, `head`, `dd`, `tr` and `sleep`, so they run the same on the Linux runner.
- A test uses `blocks_push: true`. The other branch of `spawn_one` reads the GitHub token from the credential store. A test of an Auto child spawns with `is_auto_child: true` (`spawn_as_auto_child`) and holds the `ParentEnv` lock, because the turn registry in `query_bridge/auto_child.rs` is process wide. To prove what the bridge sees, run the fake in `hang` mode and ask `caller_of` about the sleeper pid it writes: that pid is a real descendant of the turn.
- The fake replays a recorded output. It proves our spawn and our parser, not that the flags still exist in the vendor's CLI. Only the vendor's `--help` shows that.
- `fixtures/fake-cli/argv/<provider>.<scenario>.txt` holds the argv a turn must spawn, one argument per line, with `{work_dir}` and `{prompt}` as placeholders. Scenarios are `simple-turn`, `resume` and `write-access-with-tools`. The first line is `cli-version: <version>` and must equal what the fake script prints for `--version`, so a flag change and a version bump travel together. `turn/argv_fixture_tests.rs` spawns every cell through `spawn_one` and fails with one line per cell, naming the provider and the scenario. The expected argv is a file, never computed by `turn_args`, so the code under test cannot agree with itself.
- To refresh the files after a vendor release, run `GOODBOY_RECORD_ARGV=1 cargo test --locked --lib argv_fixture` by hand, check each diff against the vendor's `--help`, and commit them with the new version in the fake script. The recorder refuses to run when `CI` is set.
- Adding a provider or a stream shape ([add-a-provider](recipes/add-a-provider.md)): add a script and a `streams/` file, then a test that asserts the argv and the lines. Prove it can fail: break the code it covers, see the test go red, restore it.

## A table rebuild proves that the rows survive

A migration that rebuilds a table (`PRAGMA foreign_keys = OFF`, a new table, a copy, `DROP TABLE`, a rename) can lose or scramble rows and still converge to the right schema, which is all `registry.test.ts` checks. Such a migration gets `packages/db/src/migrations/mNNN-<slug>.test.ts` in the same commit. The test opens `makeMigratedTestDatabase({ throughVersion: N - 1 })`, seeds rows with `insertRow` from `test-helpers/migration-rows.ts`, reads them with `selectRows`, runs the migration with `migrateThrough`, and compares every column of every rebuilt table with what it read before. A column the migration renames or remaps is remapped in the expectation, so every other column must be equal. Also seed the child tables that point at the rebuilt one (with `foreign_keys` off in the rebuild they must survive), a row with a null or dangling reference, and check `PRAGMA foreign_key_check` and the new constraints.

`registry.test.ts` enforces it: a migration with `foreign_keys = OFF` needs a `mNNN-*.test.ts` that seeds an older schema (`throughVersion` or `migrations.filter`). `REBUILDS_WITHOUT_DATA_TEST` lists the old rebuilds that have none. It only shrinks: adding a test for one of them fails until its version leaves the list.

## No stopwatch in the gate

A test that reads the clock (`performance.now()`, `Date.now()`) and asserts a budget in milliseconds fails when the runner is loaded, not when the code is slow. The required `unit` project has none. A real benchmark is named `*.perf.test.ts` and lives in the `perf` vitest project of `apps/desktop`, `packages/core` or `packages/db`. Run it with `pnpm test:perf` (or `pnpm --filter <pkg> test:perf`). It never blocks a merge: `.github/workflows/perf.yml` runs it on push to main, nightly and on demand, a push or nightly failure opens or updates one issue labeled `perf`, and the concurrency group includes the event name so a push never cancels the nightly run. The same workflow has a `bundle` job that runs on every pull request touching `apps/desktop`, `packages`, `pnpm-lock.yaml` or `bundle-budget.json`, nightly and on demand. It builds the desktop app and `scripts/check-bundle-budget.mjs` sums the js and css that index.html loads up front, raw and gzip, against `bundle-budget.json` (the measured weight plus 5 percent). It fails when a weight is over the budget and when it counted zero files, so a changed asset path cannot print 0.00 MB. The budget only falls: the pull request that shrinks the bundle lowers it (`node scripts/check-bundle-budget.mjs --suggest` prints the value for the current build). A render that must not happen is proved by a count, not by time: `features/session/components/SessionOverviewPane/CentralColumn.renders.test.tsx` mounts `CentralColumn` under a React `Profiler` and expects zero commits when a pull request of another session's mount is written and when 15 seconds pass with no Auto tree, and `shared/hooks/useSessionMountHosts/index.test.ts` does the same for the hook that picks a session's mounts out of the three cross-workspace host maps. A hook that reads one session must take its keys from `useSessionMountHosts` (or `pickKeys` with `useShallow`), never `state.mountGithub` whole. A nightly `audit` job runs `scripts/audit-gate.mjs` and opens or updates one issue labeled `security` (see CONVENTIONS.md, CI pipeline).

- A guard against a slow regex or a quadratic loop asserts the result on the pathological input in the `unit` file, and keeps its time budget in the package's perf file (for example `packages/core/src/pathological-input.perf.test.ts`). Where the code reads its input by index, count the reads instead of timing them (`packages/core/src/artifacts/grammar.test.ts`).
- The search query is guarded by `packages/db/src/queries/search.plan.test.ts`, which runs `EXPLAIN QUERY PLAN` on the query `searchIndex` really sends and checks that it walks the FTS index, reads documents by rowid or index, and never scans a table. `search.perf.test.ts` keeps the 100k message timing for the perf project.
- Never assert a duration on an array copy or another operation with no I/O.
- The streaming path keeps its numbers in one module, `store/slices/transcripts/streamBudgets.ts` (`STREAM_BUDGETS`). Three files read it. `store/store.turn-stream.test.ts` runs 1, 8 and 32 concurrent runs through the real `runTurn` and the real store, with only `@tauri-apps/api/event` replaced by `test/turnEventBus.ts`, and counts the listeners (one per window) and the listener calls per envelope, and the rows copied per flush. `store/store.sqlite-open-turns.test.ts` opens a session with 5,000 stored turn events on the story database and counts the rows and bytes of the first read and of the view's first paint against `initialTranscriptRows` and `initialTranscriptBytes`. `store/store.turn-stream.perf.test.ts` holds the time per event for listener dispatch and for the whole path (`dispatchMsPerEvent`, `totalMsPerEvent`). A change to `chat/turn.ts`, `transcripts/buffer.ts` or `selectAgent.ts` keeps the counts and the budgets green, and lowers a number in `STREAM_BUDGETS` when it makes the path cheaper.

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

A covered window suspends CSS animations. `WorkspaceLauncher` and
`SessionOverviewPane` hold their whole content inside the `fade-in`
animation, which starts at `opacity: 0`, so a capture of an occluded window
shows both blank. Uncover the window before judging either surface; a blank
capture of a covered window is not a paint failure.

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

## Keys are pressed on the real app

A shortcut test presses the key on the element that has the focus, not on
`window`. `pressShortcut` and `pressKey` (`apps/desktop/src/__tests__/helpers/pressKey.ts`)
build the event from the registry entry, with its physical `code`, and fire it on
a focused button, field or row. `__tests__/surfaces/navigation-flows/keys.test.tsx`
mounts the whole app on the real store, presses every id of `SHORTCUTS` and checks
an effect: the page, the store, an open popover or a write at the database boundary.
An id that cannot reach its context sits in the exemption list of that file with its
reason, and the list can only get shorter. Review and activity keys run on a seeded
world of the same app (`bootWorld`).

### Scene registry

The registry smoke test renders every scene through the story store harness and
checks the committed sorted scene list. Regenerate that list with
`GOODBOY_UPDATE_BASELINE=1` when adding or removing scenes. Duplicate ids fail at
module load with both file names; unknown ids render an alert instead of silently
opening the workspace. The accessibility suite remains the owner of violation
baselines.

### Tests do not depend on the hour

A test that reads the clock, or that builds a seed with `sceneClock` (it shifts every seed time to the moment the module loaded), must give the same answer at any hour and in any time zone. Pin the instant before the seed module loads, with the local wall clock and not a UTC string: `vi.hoisted(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 18, 10, 31)); })` (see `columnKinds.test.tsx`, `activityRunSeed.test.ts`). Build a fixed instant from local parts (`new Date(2026, 8, 28, 15, 0)`) when the code under test compares local days, and compute the expected day label with `Intl.DateTimeFormat` in the test, never as a literal that holds only in one zone. A UTC string such as `2026-10-03T12:00:00Z` is a different local day somewhere between -11 and +14. The `test-time-zones` job of `ci.yml` runs the scene-backed tests in four clocks (`Pacific/Kiritimati`, `Pacific/Pago_Pago`, and the zones that put the local time just before and just after midnight right now), so a new hour-dependent test fails on the pull request. Run it by hand with `TZ=Pacific/Kiritimati pnpm --filter @goodboy/desktop exec vitest run --project unit <files>`, or `TZ="$(node scripts/test-time-zone.mjs before-midnight)"`.

### Scene measures

The scene measures workflow has two kinds of step. `chrome ready` (the mock
preview answers, Chrome starts, the warm-up scene renders; `--ready-only` runs
just this) is a normal step: when it fails the job is red, so an infrastructure
fault never looks like a pass. `scene measures` is advisory
(`continue-on-error` on the step) and must never be configured as a required
check. Its findings reach the pull request three ways: one `::error`
annotation per failure (the first ten, then a count), the failing scene ids and
the run time in the run summary, and a final `::error` when the step failed or
timed out. A crash that names no scene prints `scene measures: crashed`.

A measure that saw nothing is a failure. `open` throws `scene <id>: did not
become ready` after three tries, and the run records it as a failure of that
scene and goes on. Each probe fails with `measured 0 <subject>` when it found no
rows, cells or triggers, and the menu sweep fails when no scene in it had a
single trigger. An empty `VALIDATE_CHROME` falls back to the default path.
Probes and their ready selectors must follow the markup: a selector the app no
longer renders is reported by the next run, never skipped. `--only core` runs
the activity and inbox probes without the menu sweep. After two stable weeks the
cheap probes (`frames`, `columns`, `header-line`) can become a required job of
their own; the menu sweep stays advisory.

### Frame probe

A layout claim is proved by geometry, here, and by no class or attribute in a unit test. `scripts/validateScenesFrame.mjs` exports `FRAME_SCENES`, the one list of about thirty scenes, and the scene job measures each at 1100, 1440 and 1920 wide with the sidebar pinned and on the rail (one viewport change and one reload per pair). A failure names the scene, the width, the sidebar and the rule. The rules, with a tolerance of 1px:

- the h1, the trail's first crumb when the page draws one (only studio pages under a trail still do) and the first body column share one left edge, and a scene with no h1 fails this rule instead of skipping it; an h1 under an overlay drawer's scrim (an `inert` page) is still measured (an entry marked `isBare: true` is a pane mounted without its studio frame or a drawer with no page title, so it is held to the sheet rules only);
- every `[data-slot]` inside the page container lies inside it (a slot under a scroller may sit below the fold, and one a horizontal scroller moved out sideways, like a Board lane, is not counted);
- no left rail rect overlaps the trail;
- the crumb row centre equals the drawer header centre when a drawer is open;
- a composer's bottom is at or above the sheet bottom;
- a `data-container="drawer"` is a sibling of its `data-container="page"`, never inside one;
- on the empty chat scene, the stage centre is on the detail centre in x and at 40 to 52 percent of the detail height in y.

To add a scene, add its id to `scenes.txt` through the scene registry, then one entry to `FRAME_SCENES`: `{ scene, rail }`, where `rail` is the query that collapses the sidebar (`&rail=1` for a scene on `WorkspaceFrame` or `BoardShellScene`, `&ctx=rail` for `frame&view=...`) or `null` when the scene draws no sidebar. A scene with no `data-container="page"` fails the probe (wrap a bare scene in `PageSheet`, which is the real `DrawerColumn`), and a crumb that sits outside the detail column is not measured, and an id missing from `scenes.txt` fails before any measure, because an unknown id would silently render the workspace scene. Run one scene with `pnpm validate:scenes --only frames:<text>` against `vite preview` of a mock build; the rule functions have fixtures in `scripts/validate-scenes.test.mjs`.

### Layer probe

Stacked layers are proved in a real browser, because a unit test cannot tell what is on top at a point or where Tab goes. `scripts/validateScenesLayers.mjs` exports `LAYER_SCENES`, four scenes: the Ask drawer over the page (`drawer-overlay-narrow`), the notifications popover (`notifications&view=center`), the command palette (`command-palette`) and the image lightbox (`image-lightbox`). For each, the scene job checks:

- `document.elementFromPoint` at the centre of the layer returns the layer or a descendant, so nothing paints or hit-tests above it;
- a modal layer (drawer, palette, lightbox) holds focus: the probe focuses its first control, presses Tab up to its control count plus two times through the DevTools key events, and fails the press that lands on a page element outside the layer (focus handed to the browser chrome, a `body`, is not an escape);
- a wheel turned on the backdrop (4px from the top left corner of the viewport) leaves every scroller outside the layer, the document included, at the `scrollTop` it had.

The probe is advisory: in the full run a finding prints as `layers advisory: ...` and never fails the job. `pnpm validate:scenes --only layers` makes the same findings fail, which is how to prove a fix. To add a layer, add a scene that opens it by itself and one entry `{ scene, label, layer, isModal, isWheelChecked }`, where `layer` is the selector of the layer's own box. A popover is not modal and its backdrop is not held to the wheel rule. The pure rule `layerFailures` has fixtures in `scripts/validate-scenes.test.mjs`.
