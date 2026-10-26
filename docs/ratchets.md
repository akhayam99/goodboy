# Ratchets

> **Read this when** a ratchet, a rule check or `check:baselines` fails, or
> you add a rule that counts something. **Not for** the rules themselves
> ([AGENTS.md](../AGENTS.md)) or how to write a test
> ([testing.md](testing.md)).

A ratchet counts a thing that must go away, per file, and fails when a count
grows or a new file has any. It only turns one way. Debt goes down, never up.

## Who may raise a baseline

Only the owner. A builder or an agent never raises a count, never adds a key
above zero and never moves code to dodge a count. If the right change grows a
count, stop and say so in the PR.

When the owner approves a raise, it goes in `baseline-exceptions.json` at the
repo root, one entry each: `{ "rule", "file", "count", "reason", "release" }`.
`rule` is the baseline name (`store-mocks`) or the rule id inside it
(`else-branch`), `file` is the key that grew, `count` is the most it may reach,
`release` is the release that lists it. The release PR lists every entry.
The file starts as `[]`.

## The two checks

- `pnpm run check:rules` runs the forbidden-pattern rules on a file list and
  prints `rules ok`, or one line per new offense with the fix. `--staged`
  reads the index (the pre-commit hook runs it), the default reads the
  branch diff against `origin/main`, `--all` reads the whole tree. The rule
  table is `scripts/rules/forbiddenPatterns.mjs`; `forbidden-patterns.test.ts`
  runs the same table over the whole tree.
- `pnpm run check:baselines` compares every `*.baseline.json`, `eslint-suppressions.json` and every
  `ALLOWED` map in `apps/desktop/src/__tests__` with `origin/main` (or
  `--base <ref>`). It prints `baselines ok`, or fails on any entry that grew,
  any new key above zero that `baseline-exceptions.json` does not list and any
  key that names a file that does not exist.
  A baseline file that does not exist on the base starts at zero. One that
  holds a count above zero fails as `new baseline file` unless the owner lists
  it in `baseline-exceptions.json` with rule `new`, the file path and a `count`
  that caps the file's total (today's debt, so the ledger cannot grow before it
  ships), or it is
  a rename or split of a removed baseline that carries no more than the
  removed ones did. A baseline that disappears while it still held debt fails
  as `baseline removed` the same way (rule `removed`). A new rule key in an
  existing baseline (`forbidden-patterns.baseline.json` gaining `my-rule`) is
  still read as a new ratchet at its first measured count: the key is absent
  on the base, not zero.

### What `check:baselines` forgives

A path that moves or splits carries its debt. A new path under a rule passes
when it stays inside the count that files of the same rule freed on the base:
`a.ts: 3` becoming `a.ts: 1` and `aRows.ts: 2` passes, `aRows.ts: 3` fails. The
same holds for a rename and for an `ALLOWED` entry. Two limits keep it honest:

- A fall of one rule never pays for a new file of another rule.
- A key whose file did not exist on the base frees nothing, so deleting a dead
  key never buys room for a new file. An existing key that grows is never
  netted: it needs the owner and `baseline-exceptions.json`.

A key that names a file that is gone fails, wherever the file sat: prune it.
A new file at a recycled path therefore never inherits an old allowance. A key
is read as a path when it ends in a source or config extension, relative to the
repo root or to `apps/desktop/src`, and `@/` stands for `apps/desktop/src`.

CI runs both in the `checks` job.

## Forbidden patterns

`forbidden-patterns.test.ts` holds two shared baselines. `forbidden-patterns.baseline.json`
keeps the counts of the original rules over product source. Its sibling
`forbidden-patterns-guards.baseline.json` keeps every rule added later, and the
counts of the original rules over files they did not scan before (tests, CSS,
`scripts/`, `website/src`).

| Rule                                         | What it counts                                                    | Baseline |
| -------------------------------------------- | ----------------------------------------------------------------- | -------- |
| `param-shape`                                | a function with a positional, bare or inline-object parameter     | own      |
| `boolean-name`                               | a boolean (optional, nullable, `useState`) without a prefix       | own      |
| `if-without-braces`                          | an `if` whose body is not a block                                 | own      |
| `unused-import`                              | an imported name nothing in the file reads                        | own      |
| `entity-keyed-setting`                       | a `settings` key built with a workspace, project or session id    | own      |
| `rust-else`                                  | `} else` in `apps/desktop/src-tauri/src`                          | guards   |
| `sibling-margin`                             | `m*-` and `ml-auto` classes in TSX and CSS (`mx-auto` is allowed) | guards   |
| `optical-nudge`                              | a `mt-0.5` or `-mt-px` nudge, counted apart from `sibling-margin` | guards   |
| `hook-folder`                                | a `useFoo.ts` file outside `useFoo/index.ts`                      | guards   |
| `props-named-props`                          | a local `type NameProps` in the file of component `Name`          | guards   |
| `comment`, `em-dash`                         | also in tests, CSS, `scripts/` and `website/src`                  | both     |
| `em-dash`                                    | U+2013 and U+2014, also in `.md` and `.json` files                | guards   |
| the original rules (`else-branch`, `any`, …) | also in `website/src`                                             | both     |

A rule marked `own` reads the syntax tree (`scripts/rules/ast/`, parsed with the
TypeScript compiler, no type information) and keeps a baseline file of its own:
`forbidden-patterns.param-shape.baseline.json`,
`forbidden-patterns.boolean-name.baseline.json`,
`forbidden-patterns.if-without-braces.baseline.json`,
`forbidden-patterns.unused-import.baseline.json` and
`forbidden-patterns.entity-keyed-setting.baseline.json` (a line rule, not a
syntax tree rule; its hint points at `workspace_values` and `project_values`).
Each was created once at the measured count, so `check:baselines` read it as a new ratchet. They replace
`unbraced-if`, `inline-object-param`, `positional-param` and `boolean-prefix`,
retired once every file counted at least as high under the syntax tree. The
prefixes `boolean-name` accepts and the lint accepts are one constant,
`scripts/rules/ast/booleanPrefixes.mjs`. The two baselines at zero stay as files:
a new hit fails at once.

Tests are scanned only by `comment` and `em-dash`. Every other rule skips a
test file, unless its row above says otherwise.

`hook-folder` allows the sibling case of [file-system.md](file-system.md):
`Name/useName.ts` beside its component.

## Baseline files

| Baseline                                                 | Guards                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `forbidden-patterns.baseline.json`                       | the original rules over product source                                 |
| `forbidden-patterns-guards.baseline.json`                | every later rule, and the originals over new trees                     |
| `forbidden-patterns.<rule-id>.baseline.json`             | a rule with `ledger: 'own'`                                            |
| `whole-record-selectors.baseline.json`                   | `useAppStore` selectors on a whole record keyed by an id               |
| `ambient-target-session.baseline.json`                   | store reads of the current session, agent or project                   |
| `optional-mount-param.baseline.json`                     | an optional `mountId` in a store file                                  |
| `set-before-await.baseline.json`                         | store files that `set` before their first `await`                      |
| `catch-return.baseline.json`                             | a `catch` block that only returns, in a store file                     |
| `class-assertions.baseline.json`                         | class assertions in desktop tests                                      |
| `truthy-queries.baseline.json`                           | `expect(getBy*(...)).toBeTruthy()`                                     |
| `store-mocks.baseline.json`                              | tests that mock the store                                              |
| `test-casts.baseline.json`                               | casts in tests                                                         |
| `escape-and-keys-use-the-stack.baseline.json`            | `'Escape'` and window key listeners                                    |
| `time-formatting-goes-through-the-module.baseline.json`  | own date and time formatting                                           |
| `copy-budget.baseline.json`, `jargon-copy.baseline.json` | long or internal on-screen copy                                        |
| `contractions-copy.baseline.json`                        | could not, cannot and other spelled out negations                      |
| `doc-budget.baseline.json`                               | long sentences and paragraphs, long picture text, code names in docs   |
| `website/scripts/site-copy.baseline.json`                | retired names and em or en dashes in the website copy                  |
| `former-names-guard.baseline.json`                       | former names that the retired names guard cannot catch                 |
| `cross-feature-imports.baseline.json`                    | imports across features                                                |
| `control-heights.baseline.json`                          | a height class on a control                                            |
| `popover-widths.baseline.json`                           | popover widths off the scale                                           |
| `row-hover-copies.baseline.json`                         | hand-copied row hover styles                                           |
| `scale-rules.baseline.json`                              | type, icon and spacing scale violations                                |
| `disabled-opacity.baseline.json`                         | a disabled control dimmed by hand, not by the role                     |
| `loading-is-a-skeleton.baseline.json`                    | a visible Loading word where a skeleton belongs                        |
| `eslint-suppressions.json` (root)                        | the seven typed lint rules                                             |
| `eslint-suppressions-strict.json` (root)                 | the strict pass: bare conditions and loose compares                    |
| `hand-made-chips.baseline.json`                          | hand-rolled status pills                                               |
| `hand-made-dots.baseline.json`                           | a round status span, not `StatusDot`                                   |
| `hand-made-meters.baseline.json`                         | a bar track with a styled width, not `Meter`                           |
| `own-focus-ring.baseline.json`                           | a focus ring written by hand, not `FOCUS_RING`                         |
| `ui-exports-have-consumers.baseline.json`                | a `@goodboy/ui` export that nothing reads                              |
| `raw-button.baseline.json`                               | a raw `<button>` instead of a `@goodboy/ui` primitive                  |
| `raw-row-button.baseline.json`                           | a raw row button instead of `SelectableRow`                            |
| `hand-made-notices-and-empty-lines.baseline.json`        | hand-rolled notices and bare empty lines                               |
| `hand-rolled-radio-groups.baseline.json`                 | radio groups outside `SegmentedTabs`                                   |
| `ambient-target.baseline.json`                           | store slice reads of the current workspace or mount                    |
| `catch-swallow.baseline.json`                            | `.catch(() => undefined \| null \| {})`                                |
| `busy-controls.baseline.json`                            | async controls that do not say they are busy                           |
| `fill-child-uses-min-h-0.baseline.json`                  | `h-full` beside a `shrink-0` sibling                                   |
| `hand-indent.baseline.json`                              | hand-indented disclosure bodies                                        |
| `hand-rolled-icon-buttons.baseline.json`                 | icon-only buttons that are not `IconButton`                            |
| `identical-ternary.baseline.json`                        | a ternary with the same value on both sides                            |
| `inline-confirm-placement.baseline.json`                 | inline confirms off their place                                        |
| `native-title.baseline.json`                             | a native `title` instead of `Tooltip`                                  |
| `no-layout-by-attribute.baseline.json`                   | layout claims proved by an attribute or a class                        |
| `popover-anchoring.baseline.json`                        | popovers not under their trigger                                       |
| `resolver-entrypoints.baseline.json`                     | files that ask the old resolver entry points                           |
| `rust-spawn-sites.baseline.json`                         | process starts outside `src-tauri/src/proc`                            |
| `truthy-queries.defined.baseline.json`                   | `expect(getBy*(...)).toBeDefined()` or `.not.toBeNull()`               |
| `no-wall-clock-in-unit.baseline.json`                    | a time budget asserted in a unit test                                  |
| `no-real-wait.baseline.json`                             | a promise that resolves on a real `setTimeout`                         |
| `static-store-imports.baseline.json`                     | tests that import the store statically                                 |
| `hand-written-tauri-mocks.baseline.json`                 | tests with their own Tauri core mock                                   |
| `hand-written-db-mocks.baseline.json`                    | tests with their own `@goodboy/db` mock                                |
| `provider-id-comparisons.baseline.json`                  | `=== 'cursor'` and the like: branches on a provider id                 |
| `no-layout-by-attribute.elsewhere.baseline.json`         | the same claims outside `__tests__/surfaces`                           |
| `file-lines.baseline.json`                               | a component past 250 lines or another module past 600                  |
| `test-file-lines.baseline.json`                          | a test file past 1,000 lines                                           |
| `duplicate-helper.baseline.json`                         | a private helper name written in three or more files                   |
| `cross-feature-hook-folders.baseline.json`               | a `use*` folder at the root of another feature                         |
| `shared-imports-features.baseline.json`                  | an import from `shared/` into `features/`                              |
| `flat-component-pairs.baseline.json`                     | a flat `Name.tsx` with a `Name.test.tsx` beside it                     |
| `index-only-folders.baseline.json`                       | a component folder that holds only `index.tsx`                         |
| `kebab-modules.baseline.json`                            | a kebab-case `.ts` module                                              |
| `hook-folders-under-hooks.baseline.json`                 | a `use*` folder outside `hooks/` and component folders                 |
| `types-function-bodies.baseline.json`                    | a function body in `packages/types` that is not a guard                |
| `drawer-host-imports.baseline.json`                      | feature imports in `app/components/DrawerHost.tsx`                     |
| `artifact-family-cycles.baseline.json`                   | imports across a two-way pair of artifacts, plans, reports, wireframes |

All sit in `apps/desktop/src/__tests__/regressions/`. `no-skipped-tests.test.ts` has no baseline: its count is zero and stays zero.

## Allowlists

An `ALLOWED` map in `apps/desktop/src/__tests__` is a ratchet too: a file may
stay, a new one may not. `check:baselines` reads each map (a number map, a map
of `{ count, reason }` or a set of paths) and fails when an entry grows or a
new one appears. The maps live in `divider-sits-between-chrome.test.ts`,
`tone-is-a-rail-not-a-fill.test.ts`, `tone-edges-are-inner-lines.test.ts`,
`lookups-by-id-use-the-index.test.ts`, `inline-empty-states-use-the-wrappers.test.ts`,
`dog-mascot-only-marks-the-brand.test.ts`, `actions/handBuiltMenus.test.ts`,
`beta-chip-only-in-footer.test.ts`, `filter-triggers.test.ts`,
`migrations-boot-only.test.ts`, `model-versions-live-in-the-catalog.test.ts`,
`no-hover-only-actions.test.ts`,
`store-folders-stay-small.test.ts`,
`ui-code-reads-data-through-the-store.test.ts`,
`window-events-go-through-the-dispatcher.test.ts`
and `worktree-status-reads-go-through-the-cache.test.ts`.

`scripts/ratchets-doc.test.mjs` fails when a `*.baseline.json` or a test with an
`ALLOWED` map is not named on this page.

## Value guards

Three tests guard a value, not a count.

- `apps/desktop/src-tauri/tests/outbound_hosts.rs` reads every `http://` and
  `https://` literal in `src-tauri/src` outside `#[cfg(test)]` and `tests.rs`,
  and checks each host against `tests/outbound_hosts.allowlist`, one
  `host | reason` per line. A host that is not listed fails, and so does a
  listed host no source names. A new line needs the owner: it is a new place the
  app may call.
- `undo-sites-have-tests.test.ts` needs, for every file that calls `undoable(`,
  a test beside it that names undo or the file, or a test elsewhere that names
  both. Its `EXEMPT` list holds the sites still without one and only shrinks: a
  site that gains a test must leave the list.
- `wireframe-growth-is-frozen.test.ts` holds `features/wireframes` to a ceiling
  of production lines. The feature stays, but plans and reports come first, so
  the folder does not grow. A cut lowers `WIREFRAME_LINE_CEILING` in the same
  commit, because the test also fails when the ceiling is above the count.

## Add or lower a ratchet

- A cleanup that removes occurrences regenerates its baseline in the same
  commit: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/forbidden-patterns.test.ts`.
  Read the diff: every number must fall.
- A new rule goes in `scripts/rules/forbiddenPatterns.mjs` with a `hint` that
  names the fix, a flagged and an allowed case in the `FIXTURES` table of
  `scripts/rules/forbiddenPatterns.test.mjs` (a rule id without a row fails
  the build), and a first baseline at today's
  count. A wrong pattern fails every later change, so test it on edge input.
  Give the rule `ledger: 'own'` and its counts go to
  `forbidden-patterns.<rule-id>.baseline.json`, written by the same
  `GOODBOY_UPDATE_BASELINE=1` run and read by `readBaselines`. A file absent on
  the base is a new ratchet: if it starts above zero, the owner lists it once
  with rule `new` and its total as `count`. Prune that entry once the file is
  on main.
- A baseline above the real count is slack. `forbidden-patterns.test.ts` writes
  the files, their count and the regenerate command to stderr and never fails a
  pull request for it. With `GOODBOY_FAIL_ON_SLACK=1` it fails, which is the
  switch for a run on `main` at release time. It never edits a baseline.
- A rule needs a regex only when a line can say it. A rule that needs types
  (truthiness, floating promises, effect dependencies) does not belong here.
