# Testing

> **Read this when** writing or reviewing tests: what to cover and how to
> assert. **Not for** where test files live (`docs/file-system.md`).

This file says what to test and how. Where test files go: [file-system.md](file-system.md).

## Content and rules

- 1 to 5 assertions per test, focused on behavior.
- Cover: it renders without crashing, key text / aria, 1-3 main user interactions, and edge states (loading / empty / error) if the component has them.
- Use `@testing-library/react` queries (`getByRole`, `getByText`). To check that a node is there, call `getBy*` on its own: it throws when the node is missing. To check that it is gone, write `expect(queryBy*(...)).toBeNull()`. `expect(getBy*(...)).toBeTruthy()` checks nothing the query did not already check. Write the bare call when you touch such a test. `truthy-queries.test.ts` below counts what is left and never lets it grow.
- `__tests__/regressions/` holds grep checks over the source tree. `forbidden-patterns.test.ts` compares per-file counts of the AGENTS.md forbidden patterns with `forbidden-patterns.baseline.json`. It fails when a file grows or a new file has any. A change that removes occurrences regenerates the baseline in the same commit, with `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/forbidden-patterns.test.ts`. Never regenerate it to absorb new occurrences. Migrations are append-only, so their rows stay.
- `__tests__/regressions/escape-and-keys-use-the-stack.test.ts` counts `'Escape'` literals and `window` or `document` keydown listeners in product code, per file, against `escape-and-keys-use-the-stack.baseline.json`. `packages/ui/src/escape.ts` and `shared/keyboard/dispatcher.ts` are exempt, and so is `shared/keyboard/registry.ts` for the `'Escape'` literal alone, because the registry names the Esc key of the selection group for the help page while the escape stack still does the work. A count may fall and never grow, and a new file starts at zero. Esc goes through `useEscapeLayer` and a shortcut through the registry with `useShortcut`. When a change removes handlers, regenerate the baseline in the same commit: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/escape-and-keys-use-the-stack.test.ts`. Never regenerate it to absorb a new handler.
- `__tests__/regressions/time-formatting-goes-through-the-module.test.ts` counts `toLocaleTimeString`, `toLocaleDateString`, `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` in product code, per file, against `time-formatting-goes-through-the-module.baseline.json`. `shared/utils/time/formatIntl.ts` is exempt. A count may fall and never grow. A test of a date, time or age formatter pins the zone with `usePinnedTimeZone` (`src/test/usePinnedTimeZone.ts`) and never reads the machine zone. Regenerate the baseline only when a change removes call sites: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/time-formatting-goes-through-the-module.test.ts`.
- `__tests__/regressions/copy-budget.test.ts` reads the text a person sees (JSX text and copy properties under `features/`, `app/components/` and `shared/components/`, through the walker in `scanCopy.ts`) and counts, per file, against `copy-budget.baseline.json`: a `description`, `hint`, `help`, `meta` or `body` over 13 words, a position phrase ("shows up here", "above", "below"), first person in a copy property, a sentence that opens in lowercase, and each retired word of `RETIRED_NAMES` in `shared/names.ts`. A count may fall and never grow, and a new file starts at zero. A change that cuts copy does not touch the baseline: the owner of the release regenerates the file once, with `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/copy-budget.test.ts`. `jargon-copy.test.ts` shares the walker and works the same way. When the release closes the ratchet, run both with `RATCHET_CLOSE=1` to fail on any baseline entry above its measured count, then regenerate. `settingsDirectory.test.ts` holds the Settings rail rows to 24 characters and no period.
- A relative `vi.mock('./x')` must point at a file that exists. A mock of a moved or deleted module mocks nothing, and the real module runs. `__tests__/regressions/relative-mocks-resolve.test.ts` fails on it.
- A rule that lives in both TypeScript and Rust is pinned by one JSON fixture that both test suites read. The slug rule uses `packages/core/src/slug/slug.fixture.json`: `slug.test.ts` and the `worktree/slug/tests.rs` tests assert the same input to output rows. Change a row in the fixture, never in one side.
- No DOM snapshots: a serialized tree pins every class and breaks on a dependency bump without catching a bug. Assert roles, text and ARIA, and drive the interaction. A snapshot is for text a person reads in review, such as a prompt or a table of defaults, and a prompt goes to a file with `toMatchFileSnapshot`.
- Do **not** test implementation details (internal state, css classes that are only for looks, prop drilling).
- For store slices: test the contract (given state X + action Y, expect state Y'), not the internals.
- For hooks: `renderHook` from `@testing-library/react`.
- Some suites have a per-test hook that dynamically `import()`s a large module graph. Such a suite loads that import once in `beforeAll`, with a timeout that fits it. Never in `beforeEach`. There, the import cost lands on whichever test runs first, and on a busy machine it goes past the 15s hook timeout in `apps/desktop/vitest.config.ts`. Never raise the global timeouts to hide it.
- `__tests__/regressions/store-mocks.test.ts` counts the `vi.mock` and `vi.doMock` calls in `apps/desktop/src` whose target resolves to `store/store`, `store/index`, the `store` folder or a module under `store/slices/`, per file, against `store-mocks.baseline.json`. A mock of another module that only has `store` in its name (`onboarding-store`) is not counted. A file may keep what it has or shed it, and a new file starts at zero. It is a static scan and runs in well under a second. Regenerate the baseline only on the integration branch, with `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/store-mocks.test.ts`, so that parallel changes do not edit the same rows. Never regenerate it to absorb a new mock.
- `__tests__/regressions/truthy-queries.test.ts` counts `expect(getBy*(...)).toBeTruthy()` and `getAllBy*` in `apps/desktop` test files, per file, against `truthy-queries.baseline.json`. The query throws when the node is missing, so the assertion adds nothing. A count may fall and never grow, and a new file starts at zero. Regenerate the baseline when a change removes occurrences: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/truthy-queries.test.ts`.
- `__tests__/regressions/class-assertions.test.ts` counts `toHaveClass`, `classList.contains` and `className` or `class` attribute checks in `apps/desktop` test files, per file, against `class-assertions.baseline.json`. A class pins the look, not the behavior, and the class contract belongs to `packages/ui`. A count may fall and never grow, and a new file starts at zero. Regenerate it the same way with `src/__tests__/regressions/class-assertions.test.ts` when a change removes assertions.

## Rules for every change

These hold for each change that touches a test, and they come from tests that stayed green while the app was wrong.

1. A bug fix starts from a test that fails on the old code. The PR body names that test.
2. Assert behavior: role, text, aria, or the state of the store or the database after an action. Never a CSS class in `apps/desktop`, never `expect(getBy*(...)).toBeTruthy()`.
3. A new test does not fake the store. It loads the real one through `storyHarness` (`importStore`, `resetStoryStore`, `stubStoryInvoke`). A file whose assertions you change moves to the harness in the same change. A file that only sits next to your change stays as it is. `store-mocks.test.ts` fails on any file that mocks the store beyond its baseline.
4. A mock scene proves that a surface mounts with no console error, in both themes, and nothing more. Behavior is proved in harness tests, and geometry by capturing the scene and looking at it.
5. Delete a test that only checks that a fake function was called, one that repeats a ratchet, and one for text you removed.
6. No new real wait with `setTimeout`. Use fake timers or wait on the condition.
7. New behavior goes in a new test file beside the old one. The huge files (`buildTimelineStream.test.ts`, `WorkflowBuilderView/index.test.tsx`, `orchestrateNextStep.test.ts`) only get shorter.
8. The PR body says "tests removed n, replaced by m, files converted k".
9. A ratchet baseline never grows.

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
- To shrink it, fix the cause, then run the affected files with `GOODBOY_UPDATE_CONSOLE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run <path> --maxWorkers=3`. The run rewrites the entries of the files it ran and refuses to add a new one. Update the two constants in `console-baseline.test.ts` in the same commit. Three traps: an update run with `-t` (a test name filter) runs part of a file and drops the entries of the tests it skipped; two update runs in parallel overwrite each other; `GOODBOY_CONSOLE_REPORT` alone is refused, the guard would be off. `GOODBOY_SEED_CONSOLE_BASELINE=1` is the one switch that lets an update run add entries, and it never removes any: use it only to seed.
- A mock that throws inside code that catches it prints through `console.error` and lands on this guard. The catch swallows the throw, the console line does not. The shared db and invoke mocks below no longer throw: they record the call and fail the test in `afterEach`.
- `__tests__/regressions/console-guard.test.ts` runs fixtures through the real setup file. `console-guard-wiring.test.ts` (unit project) and `a11y/console-guard-wiring.test.ts` check that `console.error` carries the guard marker, so dropping `setupFiles` or `extends: true` from `vitest.config.ts` goes red.
- `packages/ui` and `packages/core` load their own strict `src/test/failOnConsole.ts` (no baseline: any console output fails). Their vitest config lists it in `setupFiles`.

## Store tests share one harness

Every desktop test that loads the real store goes through `apps/desktop/src/store/storyHarness.ts`. It is the only file allowed to `import()` the store module.

- Module mocks come from the harness factories, one per mocked module: `vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock())`. A test that needs a different default overrides it on the spy for that test, or passes its own stubs: `dbModuleMock({ listContextSlotsForSession: mine })` adds them over `storyDbStubs()`. It never keeps a private copy of the whole mock. The permission and plan modules are in the same set: `storySpies.invokePermissionRuleList`, `storySpies.invokeAuditRetryDrain`, `storySpies.upsertPlan` and the rest are the spies behind `permissionsModuleMock()` and `plansModuleMock()`. `tauriInvoke` answers the commands in `storyInvokeHandlers`; `stubStoryInvoke` adds or replaces one for a test.
- Spies live in `storySpies`, named after the function they stand in for (`storySpies.invokeBudgetRuleList`). `resetStorySpies()` restores every default.
- The store loads once: `useAppStore = await importStore()` in `beforeAll` with `STORE_IMPORT_TIMEOUT_MS`. Then `await resetStoryStore()` runs in `beforeEach` (spies reset, `initialState` applied, local storage cleared) before the test seeds its own state.
- `__tests__/regressions/store-import-pattern.test.ts` fails on any test that `import()`s the store module itself. A test that needs another export of the store module (`summarizerQueues`) takes it from `importStoreModule()`.

### Store on a real sqlite

A test that must prove what the store writes runs on the real `@goodboy/db` over an in-memory migrated database. It is named `store.sqlite-<area>.test.ts` (or `<slice>.sqlite.test.ts`) and is for integration questions only: what rows an action leaves behind, and whether a write that fails halfway leaves the rows and the store consistent. Behavior that does not need rows stays on `dbModuleMock()`.

- Do not mock `@goodboy/db`. Mock `../shared/lib/db` with `sqliteDbLibModuleMock()` instead, and take every other module mock from the harness as usual. `await resetStoryStore()` then `await openStorySqlite()` in `beforeEach` give each test a fresh database (a clone of the migrated template). Seed rows with the real `insertWorkspace`, `insertProject` and the like, or through the store action under test.
- Read rows back with `rowsOf({ sql, params })`. `storySqlite()` is the database itself.
- `injectDbFault({ match, message, skip })` arms a one-shot failure for the next statement whose SQL matches `match` (`skip` lets the first n matches through). On a plain `execute`, `select` or `exec` it throws before the statement runs. Inside `transaction` it swaps that statement for one the database rejects, so the statements before it run and the real rollback undoes them: a test that expects "no half rows" tests the transaction, not the mock.
- Writes of agents and workflow definitions (`invokeAgentInsert`, `invokeWorkflowUpsert`) are `@goodboy/db` functions (`insertAgent`, `saveWorkflow`), so their behavior is tested in `packages/db/src/queries/agent-write.test.ts` and `workflow-save.test.ts`. The harness keeps them as spies; a sqlite test that needs the rows calls the real function from the spy: `storySpies.invokeAgentInsert.mockImplementation((run) => insertAgent(storySqlite(), run))`.
- `store.sqlite-turn.test.ts` drives `sendTurn` on this database: cancel, retry and cleanup leave the rows it asserts. The session summarizer writes its own `provider_runs` row after a turn, without a `routingDecision`, so a test that counts a turn's runs filters on that key and an `afterEach` waits for `summarizerQueues` to empty before the next database replaces the first.
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

- Fix a hit by stubbing the call with the value the real code returns: `storyDbStubs()` in `store/storyHarness.ts` for a db function every store test needs, `stubStoryInvoke({ command: value })` for a command one test needs, a local stub for one test. Do not stub it with `undefined` to make the message go away.
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

- The rows live in the `*.rows.tsx` files of the folder, one per group of controls; each has a `*.test.tsx` twin that runs them, so the suite splits across workers. The ratchet finds every `*.rows.tsx` in the folder and fails when one has no twin that calls `runNavigationRows`. `harness.tsx` holds the bridge mock, `boot` and the click helpers. A new page, studio, lens, settings section or navigation action adds one row to the group it belongs to, in the same commit.
- `ratchet.test.tsx` greps the store navigation actions (`open*`, `navigate`, `back`, `forward`, `goToHistory`), the `useAppOverlays` openers, the studio kinds, the settings scopes and sections, and reads the live crumb menu and palette. Anything without a row fails the test. `EXEMPT` holds the few actions that open no page, each with its reason; an entry there that gains a row, or whose action is gone, fails too.

## Database tests start from a migrated template

A `packages/db` test that needs a migrated schema calls `await makeMigratedTestDatabase()` (or `{ throughVersion: N }` to stop before the migration under test) from `test-helpers/test-db.ts`. The first call per version in a file runs the real migration chain once and keeps the serialized result; every call returns an independent in-memory clone with `foreign_keys` on. A migration test still runs the migration under test with a real `migrate(db)` on top of the clone. Tests whose subject is the runner itself (`runner*.test.ts`, `registry.test.ts`, segment checkpoints, crash resume, anything reading `MigrateResult` or passing a custom migration list) and file-backed databases keep `makeTestDatabase` plus `migrate`.

## Migration convergence sampling

For speed, `packages/db/src/migrations/registry.test.ts` tests a sample of the intermediate versions instead of all of them. That sample does not replace the per-version sql hash manifest checked into the same file. The manifest is what really stops anyone from editing a migration after release. The sample has its own minimum number of intermediate points it must reach. So if someone cuts the sample size, the test fails, instead of quietly shrinking to the first and last version. No test pins the sampled versions or the total number of migrations. Both change every release. A test that goes red for that reason teaches people to edit the expected values, and that is exactly how a hash manifest gets regenerated without anyone looking.

## Fake CLI binaries for the Rust spawn tests

`apps/desktop/src-tauri/tests/fixtures/fake-cli/` holds POSIX `sh` scripts named `claude`, `codex`, `cursor-agent`, `agy` and `opencode`, plus `streams/` with one recorded output per provider. The Rust tests copy the folder to a temp dir with `FakeCli::stage(mode)` (`src/fake_cli.rs`) and start the copy through the real code: `spawn_one` in `turn.rs` for a turn, `run_planner` and `run_summarize` for the side jobs, `detect_binary_within` and the `check_*_auth_with` functions in `providers.rs` for detection and sign-in. The tests live in `src/turn/fake_cli_tests.rs`, `src/providers/fake_cli_tests.rs` and `src/providers/cli_args/fake_cli_tests.rs`, and run under plain `cargo test --locked`.

- The `mode` file next to the scripts picks the behavior: `ok` replays the recorded stream, `fail` exits 3 with stderr, `flood` writes 300 KiB to stderr first, `hang` sleeps until it is cancelled, `partial`, `binary` and `silent` cover the odd endings, and the version and sign-in modes cover detection.
- A script writes its argv and a fixed list of env vars to `fake-cli-argv.txt` and `fake-cli-env.txt` in its working dir. A test asserts on those, so it sees what the child really got.
- The scripts keep the executable bit in git and use only POSIX `sh`, `cat`, `head`, `dd`, `tr` and `sleep`, so they run the same on the Linux runner.
- A test uses `blocks_push: true`. The other branch of `spawn_one` reads the GitHub token from the credential store.
- The fake replays a recorded output. It proves our spawn and our parser, not that the flags still exist in the vendor's CLI. Only the vendor's `--help` shows that.
- Adding a provider or a stream shape: add a script and a `streams/` file, then a test that asserts the argv and the lines. Prove it can fail: break the code it covers, see the test go red, restore it.

## A table rebuild proves that the rows survive

A migration that rebuilds a table (`PRAGMA foreign_keys = OFF`, a new table, a copy, `DROP TABLE`, a rename) can lose or scramble rows and still converge to the right schema, which is all `registry.test.ts` checks. Such a migration gets `packages/db/src/migrations/mNNN-<slug>.test.ts` in the same commit. The test opens `makeMigratedTestDatabase({ throughVersion: N - 1 })`, seeds rows with `insertRow` from `test-helpers/migration-rows.ts`, reads them with `selectRows`, runs the migration with `migrateThrough`, and compares every column of every rebuilt table with what it read before. A column the migration renames or remaps is remapped in the expectation, so every other column must be equal. Also seed the child tables that point at the rebuilt one (with `foreign_keys` off in the rebuild they must survive), a row with a null or dangling reference, and check `PRAGMA foreign_key_check` and the new constraints.

`registry.test.ts` enforces it: a migration with `foreign_keys = OFF` needs a `mNNN-*.test.ts` that seeds an older schema (`throughVersion` or `migrations.filter`). `REBUILDS_WITHOUT_DATA_TEST` lists the old rebuilds that have none. It only shrinks: adding a test for one of them fails until its version leaves the list.

## No stopwatch in the gate

A test that reads the clock (`performance.now()`, `Date.now()`) and asserts a budget in milliseconds fails when the runner is loaded, not when the code is slow. The required `unit` project has none. A real benchmark is named `*.perf.test.ts` and lives in the `perf` vitest project of `apps/desktop`, `packages/core` or `packages/db`. Run it with `pnpm test:perf` (or `pnpm --filter <pkg> test:perf`). It never blocks a merge: `.github/workflows/perf.yml` runs it on push to main, nightly and on demand, and a nightly failure opens or updates one issue labeled `perf`. The same workflow has a non-blocking `bundle` job, nightly and on demand, that builds the desktop app and writes the size of the js and css that index.html loads up front, raw and gzip, to the run summary next to the reference weights (4.9 MB, 1.44 MB gzip).

- A guard against a slow regex or a quadratic loop asserts the result on the pathological input in the `unit` file, and keeps its time budget in the package's perf file (for example `packages/core/src/pathological-input.perf.test.ts`). Where the code reads its input by index, count the reads instead of timing them (`packages/core/src/artifacts/grammar.test.ts`).
- The search query is guarded by `packages/db/src/queries/search.plan.test.ts`, which runs `EXPLAIN QUERY PLAN` on the query `searchIndex` really sends and checks that it walks the FTS index, reads documents by rowid or index, and never scans a table. `search.perf.test.ts` keeps the 100k message timing for the perf project.
- Never assert a duration on an array copy or another operation with no I/O.

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
