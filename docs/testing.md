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

## When a class is behavior, not styling

"Do not test css classes for non-semantic styling" above is about layout and
spacing, not meaning. A class that carries meaning, a status dot's tone, a
design token, a z-layer, or a motion gate, is behavior wearing a class name.
A component test that only checks structure and text is structurally blind
to it: the tone can flip, the token can drift, the animation can lose its
`prefers-reduced-motion` gate, and the suite stays green throughout.

That class of check lives as a source-parsing invariant test in
`apps/desktop/src/__tests__/regressions/`, not inside the component's own
test file: it reads the source directly and asserts the property, rather
than rendering the component and asserting on its output. Worked example:
`attention-ring-is-finite.test.ts` reads `styles.css` and asserts the
attention-ring animation is finite and gated behind
`prefers-reduced-motion: no-preference`, both properties a rendered-DOM test
cannot see. A new rule about tone, token, z-layer, or motion gate gets the
same treatment: assert it from source, in that folder.

## The golden rule

If a test fails because the component / store / hook does the wrong thing, **fix the code, not the test**. Never weaken a test to make it pass.
