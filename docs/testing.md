# Testing

Owns what to test and how. For where test files sit on disk (co-location, folder
vs flat pairs) see [file-system.md](file-system.md) → Test file placement.

Framework: vitest + `@testing-library/react` + happy-dom (already configured).

## Content and rules

- 1 to 5 assertions per test, focused on behavior.
- Cover: renders without crash, key text / aria, 1-3 main user interactions, edge states (loading / empty / error) if the component defines them.
- Use `@testing-library/react` queries (`getByRole`, `getByText`).
- Do **not** test implementation details (internal state, css classes for non-semantic styling, prop drilling).
- For store slices: test the contract (given state X + action Y, expect state Y'), not the internals.
- For hooks: `renderHook` from `@testing-library/react`.
- A suite whose per-test hook dynamically `import()`s a large module graph warms that import once in `beforeAll`, with a timeout that fits it (60s for the store, see `apps/desktop/src/store/slices/sessions/index.test.ts`). Never in `beforeEach`: the import cost then lands on whichever test happens to run first and blows vitest's default 10s hook timeout on a loaded runner.

## The golden rule

If a test fails because the component / store / hook does the wrong thing, **fix the code, not the test**. Never weaken a test to make it pass.
