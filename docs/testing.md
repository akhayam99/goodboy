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

## Reaching a state that only exists in memory

Some run states live only in the store while an async call is in flight, so
no database row reaches them and only a live provider run produces them. The
orchestrator "stopping" state is one: it needs an operator stop on the run
plus a decision still in flight, and the in-flight flag
(`orchestratingWorkflowRuns`) is never persisted, because a decision does not
survive the process that started it.

To see that state in a real build without spawning agents, name the run ids
in `GOODBOY_QA_DECIDING_RUNS` when launching the binary:

```
GOODBOY_QA_DECIDING_RUNS=<run-id>[,<run-id>] \
  GOODBOY_DB_FILE=<path> .../Goodboy.app/Contents/MacOS/goodboy-desktop
```

Boot marks those runs as deciding in memory only. Seed the operator stop
itself as an ordinary row in `session_workflows`, keyed by
`workflow_run_id`: a non-empty `orchestration_error` carries the message
(an empty value means no stop exists at all, see `toStop` in
`packages/db/src/queries/session-workflow.ts`) and `orchestration_stop_kind`
must be `'operator'`. With that row and the run named in
`GOODBOY_QA_DECIDING_RUNS`, the plain **Stopping** pill shows on the rail
card and on the collapsed sidebar row. To see it on the richer orchestrator
strip instead, the row also needs `execution_mode = 'dynamic'` and the
sidebar row expanded: the strip only renders in that combination, and the
plain pill hides itself in favor of it. Nothing is written back, so a
relaunch without the variable reports **Stopped** again. Never persist the
in-flight flag: a stored "deciding right now" is false the moment the app
restarts.
