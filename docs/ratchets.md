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
  `--base <ref>`). It prints `baselines ok`, or fails on any entry that grew
  and any new key above zero that `baseline-exceptions.json` does not list.
  A baseline file that does not exist on the base is a new ratchet and starts
  at its first measured count: the diff shows it to the reviewer.

CI runs both in the `checks` job.

## Forbidden patterns

`forbidden-patterns.test.ts` holds two baselines. `forbidden-patterns.baseline.json`
keeps the counts of the original rules over product source. Its sibling
`forbidden-patterns-guards.baseline.json` keeps every rule added later, and the
counts of the original rules over files they did not scan before (tests, CSS,
`scripts/`, `website/src`).

| Rule                                         | What it counts                                                    | Baseline |
| -------------------------------------------- | ----------------------------------------------------------------- | -------- |
| `inline-object-param`                        | a one-line signature with an inline object type                   | guards   |
| `positional-param`                           | a `packages/db/src/queries` function whose first param is `db`    | guards   |
| `boolean-prefix`                             | `useState` and a prop typed `boolean` without `is/has/can/should` | guards   |
| `rust-else`                                  | `} else` in `apps/desktop/src-tauri/src`                          | guards   |
| `sibling-margin`                             | `m*-` and `ml-auto` classes in TSX and CSS (`mx-auto` is allowed) | guards   |
| `hook-folder`                                | a `useFoo.ts` file outside `useFoo/index.ts`                      | guards   |
| `props-named-props`                          | a local `type NameProps` in the file of component `Name`          | guards   |
| `comment`, `em-dash`                         | also in tests, CSS, `scripts/` and `website/src`                  | both     |
| the original rules (`else-branch`, `any`, …) | also in `website/src`                                             | both     |

`hook-folder` allows the sibling case of [file-system.md](file-system.md):
`Name/useName.ts` beside its component.

## Baseline files

| Baseline                                                 | Guards                                              |
| -------------------------------------------------------- | --------------------------------------------------- |
| `forbidden-patterns.baseline.json`, `-guards`            | the table above                                     |
| `class-assertions.baseline.json`                         | class assertions in desktop tests                   |
| `truthy-queries.baseline.json`                           | `expect(getBy*(...)).toBeTruthy()`                  |
| `store-mocks.baseline.json`                              | tests that mock the store                           |
| `test-casts.baseline.json`                               | casts in tests                                      |
| `escape-and-keys-use-the-stack.baseline.json`            | `'Escape'` and window key listeners                 |
| `time-formatting-goes-through-the-module.baseline.json`  | own date and time formatting                        |
| `copy-budget.baseline.json`, `jargon-copy.baseline.json` | long or internal on-screen copy                     |
| `cross-feature-imports.baseline.json`                    | imports across features                             |
| `control-heights.baseline.json`                          | a height class on a control                         |
| `popover-widths.baseline.json`                           | popover widths off the scale                        |
| `row-hover-copies.baseline.json`                         | hand-copied row hover styles                        |
| `scale-rules.baseline.json`                              | type, icon and spacing scale violations             |
| `eslint-suppressions.json` (root)                        | the seven typed lint rules                          |
| `hand-made-chips.baseline.json`                          | hand-rolled status pills                            |
| `hand-made-notices-and-empty-lines.baseline.json`        | hand-rolled notices and bare empty lines            |
| `hand-rolled-radio-groups.baseline.json`                 | radio groups outside `SegmentedTabs`                |
| `ambient-target.baseline.json`                           | store slice reads of the current workspace or mount |
| `catch-swallow.baseline.json`                            | `.catch(() => undefined \| null \| {})`             |

All sit in `apps/desktop/src/__tests__/regressions/`.

## Allowlists

An `ALLOWED` map in `apps/desktop/src/__tests__` is a ratchet too: a file may
stay, a new one may not. `check:baselines` reads each map (a number map, a map
of `{ count, reason }` or a set of paths) and fails when an entry grows or a
new one appears. The maps live in `divider-sits-between-chrome.test.ts`,
`tone-is-a-rail-not-a-fill.test.ts`, `tone-edges-are-inner-lines.test.ts`,
`lookups-by-id-use-the-index.test.ts`, `inline-empty-states-use-the-wrappers.test.ts`,
`dog-mascot-only-marks-the-brand.test.ts` and `actions/handBuiltMenus.test.ts`.

## Add or lower a ratchet

- A cleanup that removes occurrences regenerates its baseline in the same
  commit: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/forbidden-patterns.test.ts`.
  Read the diff: every number must fall.
- A new rule goes in `scripts/rules/forbiddenPatterns.mjs` with a `hint` that
  names the fix, a flagged and an allowed case in
  `scripts/rules/forbiddenPatterns.test.mjs`, and a first baseline at today's
  count. A wrong pattern fails every later change, so test it on edge input.
- A rule needs a regex only when a line can say it. A rule that needs types
  (truthiness, floating promises, effect dependencies) does not belong here.
