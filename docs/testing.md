# Testing

> **Read this when** writing or reviewing test coverage and assertion style.
> **Not for** where test files live (`docs/file-system.md`).

Owns what to test and how. Test file placement: [file-system.md](file-system.md).

## Content and rules

- 1 to 5 assertions per test, focused on behavior.
- Cover: renders without crash, key text / aria, 1-3 main user interactions, edge states (loading / empty / error) if the component defines them.
- Use `@testing-library/react` queries (`getByRole`, `getByText`).
- Do **not** test implementation details (internal state, css classes for non-semantic styling, prop drilling).
- For store slices: test the contract (given state X + action Y, expect state Y'), not the internals.
- For hooks: `renderHook` from `@testing-library/react`.
- A suite whose per-test hook dynamically `import()`s a large module graph warms that import once in `beforeAll`, with a timeout that fits it (60s for the store, see `apps/desktop/src/store/slices/sessions/index.test.ts`). Never in `beforeEach`: the import cost then lands on whichever test happens to run first and blows vitest's default 10s hook timeout on a loaded runner.

## Migration convergence sampling

`packages/db/src/migrations/registry.test.ts` samples intermediate versions instead of testing all of them for speed; that sampling is not a substitute for the checked-in per-version sql hash manifest in the same file, which is what actually guards shipped migration bodies against being edited after release.

## The golden rule

If a test fails because the component / store / hook does the wrong thing, **fix the code, not the test**. Never weaken a test to make it pass.

## Reaching a state that only exists in memory

The orchestrator "stopping" state lives only in the store while a decision is
in flight (`orchestratingWorkflowRuns` is never persisted: a decision does not
survive the process that started it), so no seeded database row reaches it.

To see it in a real build without spawning agents, name the run ids in
`GOODBOY_QA_DECIDING_RUNS` when launching the binary:

```
GOODBOY_QA_DECIDING_RUNS=<run-id>[,<run-id>] \
  GOODBOY_DB_FILE=<path> .../Goodboy.app/Contents/MacOS/goodboy-desktop
```

Boot marks those runs as deciding in memory only. Seed the operator stop as an
ordinary `session_workflows` row keyed by `workflow_run_id`: a non-empty
`orchestration_error` carries the message (empty means no stop at all, see
`toStop` in `packages/db/src/queries/session-workflow.ts`) and
`orchestration_stop_kind` must be `'operator'`. That shows the plain
**Stopping** pill on the rail card and collapsed sidebar row. The richer
orchestrator strip needs `execution_mode = 'dynamic'` plus the sidebar row
expanded; the plain pill hides itself in favor of it. Nothing is written back:
relaunching without the variable reports **Stopped** again. Never persist the
in-flight flag.
