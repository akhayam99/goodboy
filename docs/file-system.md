# File system layout

> **Read this when** deciding where UI or shared code belongs between
> `apps/desktop/src/` and `packages/ui`. **Not for** runtime systems around
> the app like subprocess env or DB migrations, nor the on-disk data the app
> writes under `~/.goodboy` (see `docs/architecture.md` → On-disk data
> layout).

This page covers how files and folders are laid out in `apps/desktop/src/`, and
where desktop code ends and `packages/ui` begins. Naming:
[AGENTS.md](../AGENTS.md) → Naming. What goes in tests: [testing.md](testing.md).
How the repo's packages fit together: [architecture.md](architecture.md).

## Reuse boundary

Reusable UI that only draws things and knows nothing about the product belongs
in `packages/ui`. Code shared across features that knows the desktop app (its
domains, state, routing or runtime) stays in `apps/desktop/src/shared/`. How
many places use the code does not change this boundary.

`PaneShell`, `FacetRail`, `StarToggle` and `DogMascot` are in `packages/ui`: they
import no store, no feature and no Tauri API, and `DogMascot` carries its own
mask image in `packages/ui/src/assets/`. The work tree shows the split. `WorkNode` in `packages/ui/src/components/WorkTree/`
only draws a node from a state, a mark, a label and an optional progress.
What a row is doing (`RowState`), how long it has worked and usually takes
(`workTime`), the rail geometry and the row rhythm know agents and runs, so
they live in `apps/desktop/src/features/workTreeModel/`, which the activity
feed, the workflow run tree and the project rows all read. The folder is not
called `features/workTree`: `features/worktree` (git worktrees) already exists,
and the macOS file system folds case, so the two would share one folder on
disk and split in two on Linux.

## Top-level (`apps/desktop/src/`)

- `app/`: shell components only.
- `features/`: one directory per product domain.
- `shared/`: desktop code used across features that no single domain owns.
- `store/`: the Zustand store and its slice packages.
- `assets/`: app-level images.
- `__tests__/`: integration and regression suites that span features.
- `test/`: test infrastructure that tests and mock scenes share: `storyHarness/` (`spies.ts`, `dbStubs.ts`, `moduleMocks.ts`, `builders.ts`, with an `index.ts`; `store/storyHarness.ts` re-exports it for one release), `dbMock`, `invokeMock`, `sceneInvoke`, the in-memory chat and ask backends. No product file imports it: `__tests__/regressions/production-graph-has-no-mock-code.test.ts` walks the static imports from `main.tsx` and fails when any reach `test/` or `app/components/MockScene/`.

`App.tsx`, `main.tsx` and `styles.css` sit at the root.

Nothing else goes at the `src/` root. No `src/types/`, no `src/constants/`, no `src/models/`, no new root folder. Each of these turns into a magnet for loose global state. Domain code lives in its feature. Code shared across features has to earn its place in `shared/`.

## Feature modules (`features/<domain>/`)

A feature is self-contained:

- `<domain>.ts`: core domain logic (types, constants, pure functions). No React, no Zustand imports.
- `utils/`: private to the feature. Move it to `shared/utils/` only once a second feature needs it.
- `components/<Name>/`: see Components below.
- Assets (JSON, SVG) live next to the feature that owns them, never in `public/` or a global `src/data/`.
- `hooks/<useFoo>/`: the feature's hooks, each a folder. A `use*` folder at the feature root or in a plain folder is a legacy shape; `hook-folders-under-hooks.baseline.json` counts them and only falls. A hook tied to one component stays in that component's folder.
- Sub-areas: a feature that holds several concerns groups each in a folder named for the concept, such as `features/session/{ask,central,timeline,trail,resolve,startRun,panes,context}`. A sub-area follows the same rules inside (modules, `components/`, `hooks/`) and is not a feature: other features import it under the cross-feature rules of its parent.
- `testing/`: a folder of test builders and fixtures for the code beside it (`features/workspace/testing/`, `store/slices/gitlab-mr/testing/`). Only tests, mock scenes and `storyHarness` import it; product code never does. It is not counted as product by the scans.

### One conversation under Ask and Chat

`features/conversation/` holds what a session's **Ask** (`features/session/ask/`) and the workspace **Chat** (`features/workspace-chat/`) both stand on, so neither feature imports the other. It is owned by [features/agents.md](features/agents.md). It keeps:

- the turn plumbing: `streamChatTurn` (the provider stream to an outcome), `ChatTurnOutcome`, `cancelChatTurn`, `chatReadPath`, `resolveChatModel`, and the model choice types and helpers (`chatRouting`, `defaultChatModel`);
- the reply kernel the two send flows share: `draftChatMessage`, `settleChatReply` (done, failed or stopped), `appendReplyText` and `addReplyRead` (a settled reply drops late text), `STOPPED_BEFORE_LAUNCH`;
- the backend contract both backends extend (`ConversationBackend`: insert, finish, cancel) and the memory side of it (`createMemoryRunControl`);
- the model picker both composers draw (`shared/components/ConversationRoutingPicker`).

Ask and Chat keep their scope, their prompts (`buildAskSystemPrompt`, `buildChatSystemPrompt`), their stores (`askMessages`, `chatMessages`) and their threads. Each send flow still lives in its slice (`sendAskQuestion`, `sendChatMessage`); the failure modes both must honour are one table of tests, `sendAskQuestion.failures.test.ts` and `sendChatMessage.failures.test.ts`, rows F1 to F8.

### Boundaries between layers

- **No public entry per feature.** A feature has no `index.ts` barrel: the "no barrel" rule in [AGENTS.md](../AGENTS.md) holds. Callers import the defining file.
- **A feature never imports another feature's `components/` or `hooks/`.** Anything under `features/<other>/` whose path has a `components` or `hooks` segment counts, so `features/integrations/github/components/...` counts as well. Code two features need moves to `shared/`, or to a flat module of the feature that owns it. The count is a ratchet, not a wall: `__tests__/regressions/cross-feature-imports.test.ts` counts product-code imports per pair of features against `cross-feature-imports.baseline.json`. It fails when a pair grows, and it fails when a pair shrinks without the baseline shrinking with it, so a cleanup cannot be spent again. Delete a pair at 0.
- **A feature never imports a `use*` hook folder at the root of another feature.** `features/<other>/useFoo/` is a hook like any under `hooks/`. `cross-feature-hook-folders.test.ts` counts those imports per pair in `cross-feature-hook-folders.baseline.json`, fails when a pair grows or shrinks without the baseline, and the fix is the same: the hook goes to `shared/hooks/` or stays with its one owner.
- **`shared/` imports no feature.** It is the layer under `features/`. `shared-imports-features.test.ts` counts the imports from `shared/` into `features/` per file in `shared-imports-features.baseline.json`. When a module there has one feature as owner, it moves into that feature; when it needs a feature's part, that part moves down to `shared/`.
- **The artifact kinds do not close a cycle.** `plans`, `reports` and `wireframes` build on `artifacts`, and `artifacts` knows them only through a registry (`artifactSurfaces.ts`). `artifact-family-cycles.test.ts` counts imports between these four features that run both ways in `artifact-family-cycles.baseline.json` and only lets them fall. Pure helpers they all read, such as `splitLead` and `dropLeadingTitleHeading`, live in `shared/utils/`.
- **A feature does not import the shell.** `app/` is the top of the tree. The same test freezes the few product imports of `app/` (file by file), and they only go down. Toast is a service every feature calls, so it lives in `shared/components/Toast/`.
- **The store imports no UI.** See Store slices below.

## App shell (`app/`)

Only shell code that is global by nature goes here. `App.tsx`, `main.tsx` and `styles.css` sit at the `src/` root, not here. `AppShell` is a layout primitive in `@goodboy/ui`. A component drawn in only one feature's view belongs in that feature, not here. For breadcrumb IA and the layout of `AppTopBar` controls, see [navigation/session-rail.md](navigation/session-rail.md) and [navigation/shell.md](navigation/shell.md). Three folders, no others, and one named exception: `app/components/MockScene/` is the screenshot tool (scenes, seeds, the in-memory chat and ask backends and the mock fixtures). It is much larger than the rest of `app/`, it is loaded only through `import()` from `main.tsx` when `MOCK_ENABLED` is on (`shared/lib/mockMode.ts`), and `main.tsx` installs its backends and fixtures with `installBackends` before it renders a scene ([mock-screenshots.md](mock-screenshots.md)). Production code never imports it.

- `app/components/<Name>/`: shell components.
- `app/hooks/`: hooks that wire the shell (shortcuts, overlays, session navigation, native menu policy). Same hook rule as below.
- `app/shellArrangement/`: the pure function that decides which shell slots show.

`app/components/DrawerHost.tsx` shows one drawer at a time and does not import the drawers. A feature exports a `DrawerRegistration` for its kind (type in `store/slices/drawer/drawerRegistration.ts`, file `features/<domain>/<name>DrawerRegistration.tsx`) and `app/components/renderRegisteredDrawer.tsx` calls it; the host keeps one `case` label per kind so the switch stays exhaustive. `drawer-host-imports.baseline.json` counts the feature imports the host still has and only falls: a new drawer is a registration, an old one moves over when it is touched. `SpawnedPanel`, `AutoChildPane`, `FixRunTranscriptDrawer`, `ArtifactReadingDrawer`, `ExploreAddFolder` and `ExploreFileChanges` stay in the shell for now because each reads components of several features, and a move would add cross-feature imports.

## The folder rule

One rule decides whether something gets a folder: **a folder exists only when it holds more than its entry file**. The entry (`index.tsx` or `index.ts`) plus a test, stories or sub-files makes a folder. A lone entry is a flat file. Hooks are the one exception (below). Never create a folder for a single file and its test unless it is a component or a hook.

| Kind                                   | Shape                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Component with no test, no sub-files   | flat `parent/Name.tsx`                                                                           |
| Component with a test, stories or subs | folder `parent/Name/index.tsx` + `index.test.tsx` + `*.stories.tsx` + sub-files                  |
| Hook                                   | always a folder `useFoo/index.ts`, even when it is alone, + `index.test.ts` when non-trivial     |
| Module (any other `.ts`)               | flat pair `name.ts` + `name.test.ts`; a folder only for a package (index + sub-files), see below |

Case: components and their folders are `PascalCase`. Hook folders start with `use`. Modules are `camelCase` files named after their main export. A new file is never kebab-case.

## Components (`features/**/components/`, `shared/components/`)

Rule: **1 file = 1 export = 1 definition**.

- A component past ~250 lines, or split into sub-pieces, is a folder: `index.tsx` is the component, sub-files are imported only by it (see [typescript/components.md](typescript/components.md)).
- `file-lines.test.ts` measures it: a `.tsx` file past 250 lines, any other product module (and every `scripts/*.mjs`) past 600, and a test file past 1,000, each counted without blank and comment lines. A file over its ceiling keeps its line count in `file-lines.baseline.json` or `test-file-lines.baseline.json`, may only shrink, and a new file over a ceiling fails. Split it by this rule.
- **Never** a folder that holds only `index.tsx`. If only the index exists, it is `parent/Name.tsx`.

## Hooks

- Hook reused across domains → `shared/hooks/useFoo/index.ts`
- Hook used inside one domain → `features/<domain>/hooks/useFoo/index.ts`
- A hook is always a folder, even alone, and a folder holding only `index.ts` is correct and stays. Never flatten it. `index.test.ts` when the behavior is non-trivial.
- A hook tied closely to one parent component can stay as a sibling file in that component's folder (`Name/use<Name>.ts`).

## Modules

A module is any `.ts` file that is neither a component nor a hook. It is a flat file `name.ts` with `name.test.ts` beside it. A package folder (`name/index.ts` + sub-files) only when the module splits into several files. Store slices are the model (Store slices, below).

## Legacy shapes

Some files predate the folder rule. New code never adds one. A mechanical move flattens the component folders that hold only `index.tsx`. The rest changes only when you edit the file for another reason:

- A flat component pair `Name.tsx` + `Name.test.tsx` folds into `Name/index.tsx` + `Name/index.test.tsx`. `flat-component-pairs.baseline.json` lists them.
- A flat hook `useFoo.ts` outside a component folder becomes `useFoo/index.ts`.
- A module folder holding only `index.ts` and its test becomes a flat pair.
- A component folder that holds only `index.tsx` is a flat `Name.tsx`; `index-only-folders.baseline.json` is at zero and stays there.
- A kebab-case module (`turn-errors.ts`) is renamed to camelCase when you touch it; `kebab-modules.baseline.json` lists them. Store slice folders are kebab-case on purpose, package files follow the camelCase module rule, and a rename on touch is the only rename.
- `shared/lib/` files that are pure functions move to `shared/utils/` when you touch them (`branchPresence`, `concurrency` and `remoteHost` already did).

## Store slices (`store/slices/<name>/`)

Each slice is a **package folder**:

- `index.ts`: puts the state, actions and selectors together.
- `index.test.ts`: the test for the slice's public contract.
- `state.ts`: the state keys the slice owns, their type and their initial value, both named after the slice.
- One file per action.
- One `select<Thing>.ts` per pure selector.
- `selectors.ts`: the slice's React selector hooks (`use*`), each reading the keys the slice owns in `state.ts`. A hook that reads several slices sits in the slice that owns its primary key. A slice whose `selectors.ts` already holds pure selectors that action files import keeps its hooks in `use<Thing>.ts` files instead (`project-mounts`), so the actions never import the store. Callers get the hooks through `store/index.ts`, which re-exports each one from its source file.
- `types.ts`: types used only inside the slice. It re-exports `SetFn`/`GetFn` from `../../slice-types` when its files use them.
- Domain helpers only the slice's actions use sit in the slice as one file each, next to their test (`turn/turnHelpers.ts`, `turn/kickoff.ts`, `project-mounts/scopeGuard.ts`, `workflows/summarizeAgentOutput.ts`). The store root keeps `store.ts`, `types.ts`, `slice-types.ts`, `index.ts`, `sessionEviction.ts`, `sessionReplySettings.ts`, `mock-data.ts`, `storyHarness.ts` and the cross-slice `store.*.test.ts` files.

A slice that grows past about 60 flat files groups the files of one concern in a folder inside the slice (`resolve/publication/`). The folder holds files only, one level deep, and the slice `index.ts` stays the only registration point: nothing outside the slice imports a concern folder by deep path when `index.ts` already exports it. `__tests__/regressions/store-folders-stay-small.test.ts` fails on a new folder past 60 and holds the five that are past it today (`resolve`, `turn`, `workflows`, `project-mounts`, `runtime/auto`) to an allowlist that only shrinks.

## Store runtime (`store/runtime/<name>/`)

A folder under `store/slices/` is a slice: it owns state keys, has a slice factory and is composed in `store.ts`. Code that keeps no state and is composed nowhere is not a slice, and lives in `store/runtime/<name>/` as flat files with their tests: `auto` (the Auto runtime), `live-work` (the running-work selectors), `models` (model resolution from settings), `state-writes` (`latestOnly`, `commitAfterConfirm`, `sessionReads`) and `worktreeStatuses` (the git status cache). A runtime folder has no `index.ts`, no `state.ts` and no registration; importers name the file they use. A folder that gains state moves back to `store/slices/` with the three files above.

Rules around slices:

- `store/store.ts` only composes slices. No domain logic.
- The shared `SetFn`/`GetFn` and `SliceDeps` (`{ set, get }`) live in `store/slice-types.ts` (typed against `AppStore`).
- Every slice factory takes one `SliceDeps` object: `createXSlice = ({ set, get }: SliceDeps) => ...`. A slice that reads no state destructures only `set`. `store.ts` calls each as `createXSlice({ set, get })`.
- A slice's actions are typed by its factory: `AppStore` intersects `ReturnType<typeof createXSlice>`, so the slice is the single source and `store.ts` holds no hand-written action signatures. Do not pass `AppState`-typed `set`/`get` params between slice files: they make the factory type circular. Take `SetFn`/`GetFn`.
- A slice never imports `store/store.ts` or the `store/index.ts` barrel, directly or through a file it loads: a value the slice needs from the composed store comes in through its factory (`createWorkspacesSlice({ set, get, initialState })`), and a pure helper a slice needs sits in its own file, not in a hook or component file that imports the store (`buildIssueGroups.ts`, `jiraBranchSlug.ts` next to `useJiraIssues`). `__tests__/regressions/store-has-no-runtime-cycle.test.ts` fails on any file that `store.ts` loads and that imports it back at runtime, and its count is 0.
- A slice's state is owned the same way: `AppState` (`store/types.ts`) intersects each slice's state type and `store.ts` spreads each slice's initial state. A new state key goes into its slice's `state.ts`, never inline in `types.ts` or `store.ts`, and the initial state of every slice is named `<slice>InitialState`. `__tests__/regressions/store-state-keys-are-unique.test.ts` fails when two slices own the same key or a key is written inline in `store.ts`.
- A helper shared between files inside a slice is exported through the slice's `index.ts` only when code outside the slice needs it. Otherwise, import it straight from its source file.
- Read a session or a project by id through the index, never with `sessions.find(` or `projects.find(`: `sessionById(state.sessions, id)` and `projectById(state.projects, id)` for the active list, `selectSessionById(state, id)` (active pool first, then the archived pools) and `selectProjectById(state, id)` when the caller wants `null` for a miss, `useSessionById(id)` in a component. The index is derived, not stored: `shared/utils/findById.ts` builds an id-to-position map once per array reference and drops it with the array. `sessions` and `projects` stay the only copy of the rows, so every write path keeps the lookups right without touching an index, as long as it replaces the array instead of mutating it. The lookup returns the same row object the array holds, so a selector that returns it stays referentially stable. A lookup by another field (name, path, kind) stays a plain `find`. `__tests__/regressions/lookups-by-id-use-the-index.test.ts` fails on a new `sessions.find(` or `projects.find(` outside its allowlist, and the allowlist only shrinks.
- The store imports no UI: never `features/*/components/`, `features/*/hooks/` or `app/`, in a slice, a test or a `vi.mock` path. Logic a slice needs lives in the feature's flat modules (`features/session/taskModelAgentSpawnConfig.ts`, `features/attachments/pendingAttachment.ts`, `features/settings/settingsFocus.ts`) or in the store itself: `store/runtime/worktreeStatuses/cache.ts` is the runtime cache of git status per worktree, refreshed by slices and read by the `useWorktreeStatuses` hook. It is the one reader of that fact: `read({ key, freshness })` answers `known` (the status and the time of the read) or `unknown` (never read, failed, or older than the freshness asked for), and a flow that must see the repository now calls `readWorktreeStatusNow`, which reads again and shares the answer with every surface. A direct call of the `worktreeStatus` command outside the cache only shrinks: `__tests__/regressions/worktree-status-reads-go-through-the-cache.test.ts` fails on a new one. `__tests__/regressions/store-imports-no-components.test.ts` fails on any such import. It has no allowlist, so the count is 0 and stays 0.
- Runtime memory keyed by session, agent or workflow run lives in `AppState` and is registered in `SESSION_EVICTION` (`store/sessionEviction.ts`). The type guard there fails until every state key says how it is torn down. Slices read these counters through `get()`, never through a component selector. A module-level collection is allowed only in four cases: in-flight promise dedup, written with `createDedupeByKey` (`shared/utils/createDedupeByKey.ts`, which deletes the key when the task settles) and never as a hand-made `Map` of promises, a tombstone that must outlive its agent (`purgedAgentIds`), a per-key queue that drops its key once drained (`shared/utils/keyedQueue.ts`, the only queue: `withMountLock` is a thin call on it), or a `WeakMap` derived from a state array that is collected with the array (`shared/utils/findById.ts`).

## Test file placement

- Tests sit next to their source, with the name the folder rule gives: `index.test.tsx` in a component folder, `index.test.ts` in a hook folder, `name.test.ts` beside a flat module.
- A component test is never a flat `Name.test.tsx` beside a flat `Name.tsx`. Put both in a folder.
- Suites that span features live in `src/__tests__/`, not next to any one source.

## Shared types

- Types shared across files → `shared/types/<name>.ts`
- Types shared across packages → `packages/types/src/`
- Types used in one file stay in that file.

## Shared code (`shared/`)

`shared/` has these folders and nothing loose at its root:

- `components/`, `hooks/`, `types/`: shared components, hooks and types, by the rules above.
- `utils/`: pure functions and constants. No `invoke`, no store, no React, no browser storage.
- `lib/`: code that touches the runtime boundary: Tauri wrappers (`invokeCommand`, `db`, `dbBoot`, `editor`, `reveal`), the folder dialog (`pickFolder`), browser storage (`storage-keys`, `zoom`), theme and the feature flags. A pure function does not belong here: put it in `utils/`.
- `keyboard/`: the shortcut registry, its dispatcher, `useShortcut` and `isTypingTarget`.
- `platform/`: operating system detection.
- `detail-fields/`: the field builders the record detail panes render, one file per tracker.

Some jobs have one implementation, and a feature never rewrites them:

- Copy text: `copyToClipboard` in `packages/ui` writes through the async clipboard, falls back to a selected textarea and rejects when both fail. `useCopyText` in `shared/hooks/` calls it and shows a "Copy failed" toast. A caller that has its own error surface (the bug report, artifact export, `useCopyLink`) catches the rejection and shows it there. Never call `navigator.clipboard` directly.
- Pick a folder: `usePickFolder` in `shared/hooks/` wraps `pickFolder` in `shared/lib/` and reports a refused dialog through `reportError`. No component imports the dialog plugin for a folder.
- Is the user typing: `isTypingTarget` in `shared/keyboard/` counts input, textarea, select and contentEditable. `isTextEntryTarget` is the same without select, for the few rules where a focused select must not count.
- Saved preferences: `persistedPref({ key, parse, fallback })` in `shared/lib/storage-keys.ts` reads, validates and writes one local or session storage value, and never throws when storage is blocked. Its key comes from `STORAGE_KEYS` or `STORAGE_PREFIXES`, never a string literal in the feature.
- Answer a request from Rust: `serveHandoff({ event, command, label, execute, replyOf })` in `shared/lib/serveHandoff/` listens in the main window only, runs `execute`, replies with the result command keyed by the request id and logs a reply that could not be sent. The mount query bridge and the project materialize bridge are two calls on it; a new reverse request is a third call, never a new listener. The webview-side guard is `isTauriRuntime` in `shared/lib/`, and no file keeps its own copy of the `__TAURI_INTERNALS__` check.
- Send a window event: `dispatchWindowEvent({ name, detail })` in `shared/lib/dispatchWindowEvent/` (the name union is `windowEvents.ts`), and `openSettings` for the settings studio. Tell the other windows a fact changed: `announceDataChanged` in `shared/lib/dataChanged/`. See [event-bus.md](event-bus.md).
- Read or write nudge events: the `nudges` slice (`recordNudgeShown`, `recordNudgeOutcome`), never `@goodboy/db` from a hook.
- A value that belongs to one workspace or one project: `workspace_values` and `project_values`, read and written through `queries/entity-value.ts` in `@goodboy/db`. Its key is registered there (`WORKSPACE_VALUE_KEYS`, `PROJECT_VALUE_KEYS`), the row goes when the workspace or the folder goes, and the store caches it in `workspaceValues` when a screen needs it live. Never build a `settings` key from a workspace, project or session id: the `entity-keyed-setting` ratchet counts the builders left and only falls.
- A clock that keeps counting: `useNow`, see Shared utilities.
- A highlighted row in a listbox: `useListboxCursor({ ids, listRef, listboxId, defaultId })` in `shared/hooks/` keeps the selected id, clamps `move({ delta })`, names each option and scrolls the active one into view. The command and search modes each keep their own key switch and never write the cursor again.
- Async work with a cap: `runWithLimit({ tasks, limit })` in `shared/utils/`; there is no second pool. A last assistant message of an agent transcript is `lastAssistantMessage({ events })` in `shared/utils/`, read by both the report and the wireframe context builders.
- Poll on a timer: `usePoll({ run, everyMs, gate, isEnabled })` in `shared/lib/usePoll/`. It runs only while the window is visible (`gate: 'focused'` also needs focus), runs again when the window returns, and clears its timer and listeners on unmount. A hook never calls `setInterval` for a fetch itself.

**Where a preference lives.** It depends on what it describes, never on who wrote it. Memory of this window or this machine (a sidebar width, a fold, a sort) is browser storage through `persistedPref`. A choice that is global to the app is one row of the `settings` table; the store keeps it in `settings`, boot reads the keys it needs in one call, `getSettings({ db, keys })`, and `saveSetting` writes it. A value that belongs to one workspace or one folder is a row of `workspace_values` or `project_values`, see the list above. A new preference picks one of the three and never a second copy in another.

No other `shared/` subfolder without adding it here. A folder that holds only a test file is not a folder: the test goes next to the code it covers.

## Shared utilities

- Reusable utilities → `shared/utils/<name>.ts`, each with its `<name>.test.ts` beside it.
- A file enters `shared/` only when 2+ different features import it. When in doubt, keep it in the feature. Do not share ahead of time.
- Before you create a new shared util, grep `shared/utils/` for one you can reuse. Three guards and a mint helper are already one place: `isRecord`, `isProviderId` and `isoNow` come from `@goodboy/types/helpers`, never a private copy in a file.
- Dates, times, durations and ages live in `shared/utils/time/`, one file per formatter: `formatClock` (14:30, 24 hour), `formatDayMonth` (Sep 29), `formatDate` (Sep 29, 2026), `formatDateTime`, `formatWeekday`, `formatDuration` (1h 5m), `formatSpan` (5m), `formatAge` (5m ago) and `formatAdaptiveAge`. `formatIntl.ts` holds the only `Intl.DateTimeFormat` call: it pins `en-US` and a 24 hour clock, so the output never depends on the machine locale. A relative label takes `now` from `useNow` (`shared/hooks/useNow`) so it keeps counting; `RelativeTime` does that for a bare label. Never call `toLocaleTimeString`, `toLocaleDateString` or `Intl.DateTimeFormat` in a feature.
