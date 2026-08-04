# AGENTS.md

Agent-agnostic codebase conventions for any LLM contributor or human. The code hub: the working-memory floor every code agent keeps in mind. Tooling-specific guidance (Claude/Cursor/Copilot) lives in the tool's own dotfile (`CLAUDE.md`, `.cursorrules`, etc.) and points back here.

This file carries the floor and the forbidden-patterns checklist. The full reference lives in granular spokes under `docs/`, linked from each section. Process and monorepo rules (pnpm, turbo, tsconfig, ci, git, release) live in [CONVENTIONS.md](./CONVENTIONS.md).

Stack: Tauri 2 (Rust shell) + React + Vite + TypeScript, Zustand store, SQLite via Tauri, Tailwind + Shadcn/ui.

For canonical term definitions (workspace, session, agent, shared context, plan), see [docs/glossary.md](./docs/glossary.md).

---

## Where new code goes

- One feature only → `features/<domain>/` (a component, a `utils/` helper, or `<domain>.ts`).
- App shell (routing, layout, boot) → `app/components/<Name>/`.
- Used by 2+ features, no domain owner → `shared/{hooks|utils}/<name>.ts`.
- Zustand state → `store/slices/<domain>/`.
- DB migration → `packages/db/src/migrations/mNNN-kebab-name.ts`, registered in `index.ts` at the version in its filename (see [docs/architecture.md](./docs/architecture.md) → Database migrations).

Full file system layout, component/hook/slice folder rules, and test placement in [docs/file-system.md](./docs/file-system.md).

---

## Naming

- Components: `PascalCase`. Folder containing a component matches the component name.
- Utilities, hooks, helpers: `camelCase`. Hooks prefix `use`.
- Folders containing utilities: camelCase or short noun.
- File name matches its primary export.
- Constants: `SCREAMING_SNAKE_CASE`.
- Booleans: `is`, `has`, `can`, `should` prefixes.

### Type naming

- Since 1 file = 1 export, types are unambiguous in their file.
- Components: `type Props = { ... }`. **Never** `XxxProps`, **never** `interface` (see [docs/typescript/](./docs/typescript/)).
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

## Code rules

- TypeScript strict mode.
- No `any`. Use `unknown` + type guards when type is uncertain.
- **Zero comments.** Not WHAT, not WHY, not JSDoc. Rename until the code speaks. Only required tooling directives (`/// <reference />`) are exempt.
- No dead code. Remove, do not comment out.
- Rust: only for Tauri commands. Business logic stays in TS.

### TypeScript style

Full rules with examples in [docs/typescript/](./docs/typescript/) (index at [docs/typescript.md](./docs/typescript.md)). The hard ones:

- `type`, never `interface`. Extend via intersection (`&`), never `extends`.
- `export const` arrow, never `export function` (React class components excepted).
- Every function we declare takes one named, destructured object param (`Props` for components, `Params` otherwise), even single-arg helpers. Inline object literals in the signature are banned. Callbacks with an imposed signature (array iteratees, event handlers, `set`/`get`, prop callbacks) stay positional.
- Guard clauses with early return. No `if/else`. No inline `if` body (always braces).
- Compare explicitly, never coerce: `x != null`, `x !== ''`, `count > 0`. Booleans used directly.
- `&&` for one conditional element, ternary only when both branches render. Never gate JSX on a raw number.
- `satisfies` over `as` for const validation. Exhaustiveness with `never` in `switch` defaults. Discriminated unions for state machines, branded types for IDs (owned by `packages/types`).
- No prop spreading without an explicit type.

### Styling

Full rules in [docs/styling.md](./docs/styling.md). The hard ones:

- Separation is `gap` on the parent. Margins, `space-y/x-*`, and padding-as-spacer are banned for separation.
- Padding is surface inset only, kept compact (`p-3`/`p-4`/`p-5`).
- Edge insets belong to the host wrapper, not the child.
- Radius family is `rounded-lg` (8px); `rounded-md` for small controls, `rounded-full` for pills. No `rounded-xl` or larger.
- Separators between regions (panes, sidebar sections, toolbar groups, dialog blocks) use the `<Divider>` component from `@goodboy/ui`, rendered as a sibling. Never a `border-t/-r/-b/-l` on a container to act as a divider. Borders that define a control's own shape (buttons, inputs, popovers, chips) are fine.
- Scroll regions use the `<ScrollFade>` primitive from `@goodboy/ui`, never a bare `overflow-y-auto`. The header sits outside the fade, and the fade needs a bounded height (`min-h-0 flex-1` or a `max-h-*` on its root).
- Lists and cards stay dense: clamp prose, cap list items at three tiers, hide terminal state behind a count, one visible action per row, collapse empty sections. Never compress the artifact the user navigated to (plan body, diffs, terminal, PR description, stack traces). Full rules in [docs/styling.md](./docs/styling.md) → Compaction.

---

## Testing

Co-locate tests, 1 to 5 behavior-focused assertions, never test implementation details. Golden rule: if a test fails because the code does the wrong thing, fix the code, not the test. Full rules in [docs/testing.md](./docs/testing.md).

---

## Dependencies

Every dependency is a liability: min 100k weekly downloads or a known maintainer, MIT/Apache/BSD/ISC license only, `pnpm audit` clean, justify anything outside the approved core set in the PR. On upgrades, track the stable adopted release rather than the newest tag, keep types on the runtime's LTS, and treat every major as its own migration. Full vetting checklist and rules in [docs/dependencies.md](./docs/dependencies.md).

---

## Git workflow

Full details (commit format, PR rules, examples) in [CONVENTIONS.md](./CONVENTIONS.md) → Git workflow.

- **Branch protection**: `main` is protected. All changes via PR.
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:`, `perf:`.
- **Allowed commit scopes**: `desktop`, `ui`, `core`, `db`, `types`, `repo`, `ci`. Website changes use `repo`.
- **Branch naming**: `<user>/<type>-<kebab-description>`, e.g. `ak/feat-session-detail-skeleton`, `ak/chore-release-v0.1.31`. Never the worktree codename.
- **Language**: English only (code, commits, issues, docs, comments).

### Pre-commit hooks (lefthook)

Full details in [CONVENTIONS.md](./CONVENTIONS.md) → Pre-commit hooks.

- `pre-commit`: prettier --write on staged files, then re-stage them. No eslint: the repo has no eslint config.
- `commit-msg`: commitlint against conventional commits + allowed scopes.
- Never bypass hooks (`--no-verify`, `--no-gpg-sign`, etc.).

### Releasing

When asked to cut a release ("do a release", "ship vX.Y.Z"), follow the agent playbook in [docs/release-command.md](./docs/release-command.md) for step order and gotchas, which points to the technical runbook in [docs/release.md](./docs/release.md) for signing, notarization, updater, and homebrew mechanics. Do not improvise the steps. Signing runs under the personal Apple team, never Serenis.

---

## Architecture

Repo layout, subprocess environment, provider system, and VS Code integration in [docs/architecture.md](./docs/architecture.md).

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
- **Prop spreading without an explicit type** (`{...props}` on a loosely typed value).
- **`as` for const validation**. Use `satisfies`.
- **Non-exhaustive `switch`** over a union. Assign the scrutinee to `never` in the `default`.
- **Margins, `space-y/x-*`, or padding-as-spacer for separation**. Use `gap` on the parent.
- **Comments** of any kind. Tooling directives (`/// <reference />`) excepted.
- **Dead code as comments**. Delete it.
- **Reusing a migration version number** across concurrent branches. The runner keeps a set of applied versions, not a high-water mark, so the branch merging second finds its version already recorded and skips its migration permanently, with no error. Renumber before merging; `packages/db/src/migrations/registry.test.ts` fails CI on a duplicate version, a gap, or a filename/version mismatch. Details in [docs/architecture.md](./docs/architecture.md) → Database migrations.
- **Modifying `main` locally** (no checkout-and-pull on main; advance via PR merge).
- **Direct push to `main`**.
- **Hook bypass** (`--no-verify`, `--no-gpg-sign`).
- **`git rebase -i`** (interactive flags not supported in agent environments).
