# ADR-0005: Test file layout

**Status**: Accepted
**Date**: 2026-05-19
**Deciders**: Amin

---

## Context

The monorepo currently mixes two test layouts:

- Colocated: `foo.ts` next to `foo.test.ts` in the same directory.
- Bucketed: a `__tests__/` subfolder collecting all tests for a module.

In `packages/core` alone, seven directories use `__tests__/` (budget, github, scheduler, settings, skills, worktree, workflows) while the rest use colocated tests. `apps/desktop` has a `src/__tests__/` folder at the very root, which violates [ADR-0001](./0001-feature-first-code-placement.md) (the only allowed siblings of `app`/`features`/`shared`/`store` are `main.tsx` / `App.tsx` / `styles.css`).

Either layout is defensible. Mixing them is not — it costs readers a "where's the test for this?" cognitive tax on every navigation.

## Decision

**Colocated.** A test file lives next to the source file it tests, with the same basename and a `.test.ts` / `.test.tsx` suffix.

```
features/budget/
├── budget.ts
├── budget.test.ts
├── router.ts
├── router.test.ts
└── checker.ts
```

Not this:

```
features/budget/
├── budget.ts
├── router.ts
├── checker.ts
└── __tests__/
    ├── budget.test.ts
    ├── router.test.ts
    └── checker.test.ts
```

### Exceptions

1. **Integration / contract tests** that span multiple modules and would clutter every directory may live in a single `<package>/src/__tests__/integration/` folder. They name themselves `*.integration.test.ts` and are gated behind `describe.skipIf(process.env['INTEGRATION'] !== '1')`.
2. **Store scenario tests** in `apps/desktop/src/store/` already live next to `store.ts` and are named `store.<scenario>.test.ts`. They stay colocated; the `__tests__/store/` folder elsewhere migrates to colocation.
3. **Cross-cutting test utilities** (factories, fake clocks, mock spawn helpers) live in `<package>/src/test-helpers/` and are `devDependency`-only — never imported by production code.

### Test data shape

- **Factories, not fixtures.** Expose `function makeWorkspace(overrides?: Partial<Workspace>): Workspace` helpers that produce minimal valid domain objects with sensible defaults. Each test calls them with the smallest override possible.
- **No JSON fixtures** unless they round-trip a real external format (e.g. a `gh api pr view` payload).
- **No shared mutable test state.** Each test instantiates its own dependencies (store, db, adapters).

### Mocking

- Mock only at the boundary: `invoke`, `spawn`, network calls. Never mock internal modules; if you find yourself mocking a sibling, the boundary is in the wrong place.
- For Tauri components, the boundary is the `invoke` import. Stub it via `vi.mock('@tauri-apps/api/core', ...)`.
- For provider adapters, the boundary is the `spawn` injected via `Deps`. Pass a fake.

## Consequences

**Positive**

- A reader scanning a directory sees source + test together; the test is the documentation for the source.
- `git mv foo.ts bar.ts` naturally suggests moving the test alongside; with `__tests__/` people forget.
- Search-by-filename finds both source and test in one go.

**Negative / trade-offs**

- The seven `core/__tests__/` directories need to move. Plain `git mv` is enough; commit it as a single mechanical rename PR.
- Test files inflate directory listings. A modern editor's "hide test files" filter handles this.

## What this does NOT cover

- Test runner configuration (Vitest vs Jest) — Vitest is the default; see workspace CONVENTIONS.
- Coverage thresholds — not yet enforced.
- E2E browser tests — currently none in scope; would land in `apps/desktop/e2e/` if added.
