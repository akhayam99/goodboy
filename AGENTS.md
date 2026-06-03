# AGENTS.md

Agent-agnostic codebase conventions for any LLM contributor or human. Source of truth for file layout, naming, tests, and forbidden patterns. Tooling-specific guidance (Claude/Cursor/Copilot) lives in the tool's own dotfile (`CLAUDE.md`, `.cursorrules`, etc.) and points back here.

Stack: Tauri 2 (Rust shell) + React + Vite + TypeScript, Zustand store, SQLite via Tauri, Tailwind + Shadcn/ui.

---

## File system layout

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
- Before creating a new shared util, grep `apps/desktop/src/shared/utils/` for an existing one to reuse.

---

## Naming

- Components: `PascalCase`. Folder containing a component matches the component name.
- Utilities, hooks, helpers: `camelCase`. Hooks prefix `use`.
- Folders containing utilities: camelCase or short noun.

### Type naming

- Since 1 file = 1 export, types are unambiguous in their file.
- Components: `type Props = { ... }` (or `interface Props { ... }`). **Never** `XxxProps`.
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
- No comments unless they explain WHY, not WHAT.
- No dead code. Remove, do not comment out.
- Rust: only for Tauri commands. Business logic stays in TS.
- Separators between regions (panes, sidebar sections, toolbar groups, dialog blocks) use the `<Divider>` component from `@goodboy/ui` (a faded hairline), rendered as a sibling. Never a `border-t/-r/-b/-l` on a container to act as a divider. Borders that define a control's own shape (buttons, inputs, popovers, chips) are fine.
- Scrollable regions use the `<ScrollFade>` primitive (`apps/desktop/src/shared/components/ScrollFade`) instead of a bare `overflow-y-auto`. It owns the overflow and applies a top/bottom gradient mask that appears only on the edge that has hidden content, matching the chat scroll feel. Prefer a single page-level scroll (let the whole panel scroll) over many nested `max-h-* overflow` boxes.

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
- **`export default`**. Named exports only.
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

## Provider system

- Adapter pattern: each AI provider implements a common interface.
- Priority-based routing with usage thresholds.
- Provider config stored in SQLite, never in code.
- API keys stored securely via Tauri's credential store.

## VS Code integration

- Workspaces open in VS Code via `code /path/to/worktree`.
- Goodboy is the orchestrator, VS Code is the editor.
