# AGENTS.md

Agent-agnostic codebase conventions for any LLM contributor or human. Source of truth for file layout, naming, tests, and forbidden patterns. Tooling-specific guidance (Claude/Cursor/Copilot) lives in the tool's own dotfile (`CLAUDE.md`, `.cursorrules`, etc.) and points back here.

Stack: Tauri 2 (Rust shell) + React + Vite + TypeScript, Zustand store, SQLite via Tauri, Tailwind + Shadcn/ui.

---

## File system layout

### Top-level (`apps/desktop/src/`)

```
app/        # App shell only: routing, layout, boot, global error handling
features/   # One directory per product domain
shared/     # Code used by 2+ features, no domain owner
store/      # Zustand store + slice packages
main.tsx
```

Nothing else at `src/` root. No `src/types/`, `src/constants/`, `src/models/`: each becomes a magnet for undisciplined global state. Domain code lives in its feature; cross-feature code earns its way into `shared/`.

### Feature modules (`features/<domain>/`)

A feature is self-contained:

- `<domain>.ts`: core domain logic (types, constants, pure functions). No React, no Zustand imports.
- `utils/`: private to the feature. Promote to `shared/utils/` only once a second feature needs it.
- `components/<Name>/`: see Components below.
- Assets (JSON, SVG) live next to the feature that owns them, never in `public/` or a global `src/data/`.

### App shell (`app/`)

Only code that is global by definition: `App.tsx`, `main.tsx`, `styles.css`, and shell components (boot splash, error boundary, status bar, toast). A component rendered in a single feature's view belongs in that feature, not here.

### Components (`apps/desktop/src/features/**/components/`, `apps/desktop/src/shared/components/`)

Rule: **1 file = 1 export = 1 definition**.

- Small component, no test → flat file: `parent/Name.tsx`
- Small component WITH test → folder: `parent/Name/index.tsx` + `parent/Name/index.test.tsx`
- Large component (>~250 lines) OR split into sub-pieces → folder: `parent/Name/index.tsx` + sub-files (imported only by `index.tsx`) + optional `index.test.tsx`
- **Never** a folder containing only `index.tsx` and nothing else (no test, no sub-files). If only the index exists, flatten to `parent/Name.tsx`.

### Hooks

- Cross-domain reusable hook → `apps/desktop/src/shared/hooks/<useFoo>/index.ts`
- Domain-local hook → `apps/desktop/src/features/<domain>/hooks/<useFoo>/index.ts`
- Folder convention is the same as components: folder with `index.ts` + `index.test.ts` when test exists, flat `useFoo.ts` if no test.
- Hooks tightly coupled to a single parent component (e.g. internal state binding) can stay as sibling files in the component folder.

### Store slices (`apps/desktop/src/store/slices/<name>/`)

Each slice is a **package folder**:

```
slices/<name>/
├── index.ts                  (slice compositor: assembles state + actions + selectors)
├── index.test.ts             (slice public contract test)
├── state.ts                  (initial state + type, when non-trivial)
├── <action1>.ts              (one file per action)
├── select<Thing>.ts          (one file per selector)
└── types.ts                  (slice-local types; re-exports SetFn/GetFn from `../../slice-types`)
```

- `apps/desktop/src/store/store.ts` is composition only, no domain logic.
- Shared `SetFn`/`GetFn` live in `apps/desktop/src/store/slice-types.ts` (typed against `AppStore`).
- Slice-internal cross-file utilities export through the slice's `index.ts` only when consumers outside the slice need them. Otherwise import directly from the source file.

### Tests

- Co-located with source: `index.ts(x)` + `index.test.ts(x)` in same folder.
- Never flat pairs `Name.tsx` + `Name.test.tsx` in the parent: folder them up.
- Framework: vitest + `@testing-library/react` + happy-dom (already configured).

### Shared types

- Cross-file shared types → `apps/desktop/src/shared/types/<name>.ts`
- Cross-package types → `packages/types/src/`
- Single-file local types stay where they are used.

### Shared utilities

- Reusable utilities → `apps/desktop/src/shared/utils/<name>.ts`
- A file enters `shared/` only when imported by 2+ distinct features. When in doubt, keep it in the feature; do not pre-share.
- Before creating a new shared util, grep `apps/desktop/src/shared/utils/` for an existing one to reuse.

### Where new code goes

```
used only inside one feature?
  → React component  → features/<domain>/components/<Name>/index.tsx
  → utility/helper   → features/<domain>/utils/<name>.ts
  → otherwise        → features/<domain>/<domain>.ts
used by the app shell (routing, layout, boot)?
  → app/components/<Name>/index.tsx
used by 2+ features, no domain owner?
  → shared/{lib|hooks|utils}/<name>.ts
Zustand state?
  → store/slices/<domain>/
```

---

## Naming

- Components: `PascalCase`. Folder containing a component matches the component name.
- Utilities, hooks, helpers: `camelCase`. Hooks prefix `use`.
- Folders containing utilities: camelCase or short noun.

### Type naming

- Since 1 file = 1 export, types are unambiguous in their file.
- Components: `type Props = { ... }`. **Never** `XxxProps`, **never** `interface` (see [docs/typescript.md](./docs/typescript.md)).
- Functions / hooks / utilities: `type Params = { ... }`. **Never** `XxxParams`.
- Domain / data types keep descriptive names (`Session`, `Workspace`, `Agent`).
- Consumers rename via `import type { Props as XyzProps } from '...'` if disambiguation is needed at the call site.
- Exception: files containing multiple sub-components (e.g. a large dialog with inline `Toolbar`, `Row`, `Footer`) need disambiguated names (`ToolbarProps`, `RowProps`, `FooterProps`) because `Props` would collide. The proper fix is to split such files (see "1 file = 1 export") rather than keep the disambiguated names long-term.

---

## Sub-components and utilities

- No sub-component defined inline in a parent component file: extract to a sibling file in the same folder.
- No utility function defined inline in a component: extract to `shared/utils/<name>.ts` if reusable, or to a sibling file in the component's folder if truly local.
- Same rule for inline types: extract only if reused; keep with their owner otherwise.

---

## Exports

- Named exports only. **No `export default`.**
- One export per file (the main thing). Sub-files in a component folder export only what `index.tsx` imports.
- Barrels (`index.ts` re-exports) are allowed but must stay minimal: re-export only what external consumers actually use. Internal cross-file imports go to the source file directly.

---

## Tests: content and rules

- 1 to 5 assertions per test, focused on behavior.
- Cover: renders without crash, key text / aria, 1-3 main user interactions, edge states (loading / empty / error) if the component defines them.
- Use `@testing-library/react` queries (`getByRole`, `getByText`).
- Do **not** test implementation details (internal state, css classes for non-semantic styling, prop drilling).
- For store slices: test the contract (given state X + action Y, expect state Y'), not the internals.
- For hooks: `renderHook` from `@testing-library/react`.

### The golden rule

If a test fails because the component / store / hook does the wrong thing, **fix the code, not the test**. Never weaken a test to make it pass.

---

## Git workflow

- **Branch protection**: `main` is protected. All changes via PR.
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:`, `perf:`.
- **Allowed commit scopes**: `desktop`, `ui`, `core`, `db`, `types`, `repo`, `ci`. Website changes use `repo`.
- **Branch naming**: `feat/short-description`, `fix/short-description`, `chore/short-description`, etc.
- **Language**: English only (code, commits, issues, docs, comments).
- **Reference issues** in commits when applicable: `feat(desktop): add provider adapter #12`.

### Pre-commit hooks (lefthook)

- `format`: prettier --write on staged files
- `commit-msg`: commitlint against conventional commits + allowed scopes

Never bypass hooks (`--no-verify`, `--no-gpg-sign`, etc.).

---

## Releasing

When asked to cut a release ("do a release", "ship vX.Y.Z"), follow the runbook
in [docs/release.md](./docs/release.md). Do not improvise the steps.

In short: bump the version in all four manifests, validate with a throwaway
`-rc.N` tag, then tag the real `vX.Y.Z`. A tag push builds a signed + notarized
macOS universal `.dmg` and creates a draft GitHub Release; publishing it bumps
the Homebrew cask. Signing runs under the personal Apple team (never Serenis).

---

## Code rules

- TypeScript strict mode.
- No `any`. Use `unknown` + type guards when type is uncertain.
- **Zero comments.** Not WHAT, not WHY, not JSDoc. Rename until the code speaks. Only required tooling directives (`/// <reference />`) are exempt.
- No dead code. Remove, do not comment out.
- Rust: only for Tauri commands. Business logic stays in TS.

### TypeScript style

Full rules with examples in [docs/typescript.md](./docs/typescript.md). The hard ones:

- `type`, never `interface`. Extend via intersection (`&`), never `extends`.
- `export const` arrow, never `export function` (React class components excepted).
- Every function we declare takes one named, destructured object param (`Props` for components, `Params` otherwise), even single-arg helpers. Inline object literals in the signature are banned. Callbacks with an imposed signature (array iteratees, event handlers, `set`/`get`, prop callbacks) stay positional.
- Guard clauses with early return. No `if/else`. No inline `if` body (always braces).
- Compare explicitly, never coerce: `x != null`, `x !== ''`, `count > 0`. Booleans used directly.
- `&&` for one conditional element, ternary only when both branches render. Never gate JSX on a raw number.

### Styling

Full rules in [docs/styling.md](./docs/styling.md). The hard ones:

- Separation is `gap` on the parent. Margins, `space-y/x-*`, and padding-as-spacer are banned for separation.
- Padding is surface inset only, kept compact (`p-3`/`p-4`/`p-5`).
- Edge insets belong to the host wrapper, not the child.
- Radius family is `rounded-lg` (8px); `rounded-md` for small controls, `rounded-full` for pills. No `rounded-xl` or larger.
- Separators between regions (panes, sidebar sections, toolbar groups, dialog blocks) use the `<Divider>` component from `@goodboy/ui`, rendered as a sibling. Never a `border-t/-r/-b/-l` on a container to act as a divider. Borders that define a control's own shape (buttons, inputs, popovers, chips) are fine.
- Scroll regions use the `<ScrollFade>` primitive (`apps/desktop/src/shared/components/ScrollFade`), never a bare `overflow-y-auto`. The header sits outside the fade.

---

## Dependency policy

Every dependency is a liability. Add the minimum, vet each one, audit regularly.

Before adding any dependency, verify:

1. **Necessary?** Can we use the standard library, a Web API, Tauri APIs, or 20 lines of code instead?
2. **Maintenance**: last release within 6 months, active issues/PRs, multiple maintainers if possible.
3. **Adoption**: at least 100k weekly downloads on npm, OR strong reputation (known org/individual).
4. **Size**: bundle impact known. No hidden 5MB transitive trees.
5. **License**: MIT, Apache 2.0, BSD, or ISC only. No copyleft, no custom licenses.
6. **Security**: `pnpm audit` clean. No known unpatched CVEs.
7. **Transitive deps**: `pnpm why <pkg>` after install. If it pulls in 50 packages, reconsider.

Rules of thumb:

- Prefer Web APIs, Node built-ins, and Tauri APIs over npm packages.
- Prefer one well-maintained package over multiple small ones doing similar things.
- No utility libraries (lodash, ramda, etc.): write the function or use native methods.
- No CSS-in-JS runtimes: Tailwind only.
- No date libraries unless absolutely needed: use `Intl` and native `Date`.
- No HTTP clients: use `fetch`.
- Approved core deps: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `@tauri-apps/*`, `zustand`.
- Anything else requires justification in the PR description.

`pnpm audit` runs on CI. Manual review of `pnpm-lock.yaml` diff on every PR.

---

## Forbidden patterns

- **Em-dashes** (`—`) anywhere in code, copy, commits, PRs, or docs. Use period, comma, colon, or parentheses.
- **Borders as separators** (`border-t`/`border-r`/`border-b`/`border-l` on a container to divide regions). Use the `<Divider>` component instead. Control-outline borders (buttons, inputs, popovers, chips) are allowed.
- **`any`** types. Use `unknown` + type guards.
- **`interface`**. Use `type`; extend via intersection (`&`).
- **`export default`**. Named exports only.
- **`export function`**. Use `export const` arrow (React class components excepted).
- **`if/else`** and **inline `if` bodies**. Guard-clause with early return; always brace the body.
- **Implicit truthiness coercion** in conditions (`if (x)` on a nullable / string / number). Compare explicitly (`x != null`, `x !== ''`, `x > 0`).
- **Positional or inline-object params** on functions we declare. One named, destructured object param.
- **Margins, `space-y/x-*`, or padding-as-spacer for separation**. Use `gap` on the parent.
- **Comments** of any kind. Tooling directives (`/// <reference />`) excepted.
- **Dead code as comments**. Delete it.
- **Modifying `main` locally** (no checkout-and-pull on main; advance via PR merge).
- **Direct push to `main`**.
- **Hook bypass** (`--no-verify`, `--no-gpg-sign`).
- **`git rebase -i`** (interactive flags not supported in agent environments).

---

## Repo architecture

```
goodboy/
├── apps/
│   └── desktop/        # Tauri shell + React UI
│       ├── src-tauri/  # Rust backend (Tauri commands, SQLite, process spawn)
│       └── src/
│           ├── app/       # App shell, routing, layouts
│           ├── features/  # Feature modules (workspace, providers, chat, ...)
│           ├── shared/    # Cross-feature components, hooks, utils, types
│           └── store/     # Zustand store + slice packages
├── packages/
│   ├── core/           # Provider-agnostic domain logic
│   ├── db/             # SQLite schema + queries
│   ├── types/          # Cross-package shared types
│   └── ui/             # Shadcn-based shared UI components
└── website/            # Marketing site (standalone, not in pnpm workspace)
```

## Subprocess environment

macOS/Linux GUI apps launched from Finder/Dock inherit a minimal environment, not the user's terminal one. The Rust shell resolves the real environment from the login shell and replays it onto spawned processes (`apps/desktop/src-tauri/src/path_env.rs`):

- `command(binary)`: PATH only. The default. Use for internal git plumbing (`rev-parse`, worktree management) and any subprocess that runs no user hooks.
- `command_with_login_env(binary)`: full login-shell env, resolved once via `zsh -ilc env` and cached. Use for subprocesses that can trigger user-authored git hooks or tooling, so they behave as they would in a terminal. `run_git_push` uses it: a repo's `pre-push` hook can read variables exported in `~/.zshrc` (registry tokens, tool config).

Never skip hooks (`git push --no-verify`) to dodge a missing-env failure; replay the environment instead. Windows has no login-shell probe; this is macOS/Linux scoped.

## Provider system

- Adapter pattern: each AI provider implements a common interface.
- Priority-based routing with usage thresholds.
- Provider config stored in SQLite, never in code.
- API keys stored securely via Tauri's credential store.

## VS Code integration

- Workspaces open in VS Code via `code /path/to/worktree`.
- Goodboy is the orchestrator, VS Code is the editor.
