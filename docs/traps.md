# Traps

> **Read this when** something in the code or the toolchain looks like a bug
> and you are about to fix it. **Not for** how a system is meant to work
> (`docs/architecture.md`) or the conventions a change must follow
> (`CONVENTIONS.md`).

Comments are forbidden repo-wide, so a deliberate dead end cannot explain
itself where it sits. This file is where those explanations live. Everything
below has been "fixed" at least once and had to be put back.

## Deliberate dead ends in the code

- `fetchIssueCandidates` has a dead `case 'bitbucket': return []` arm, and
  `issueSources.ts` deliberately has no bitbucket entry. Bitbucket has no
  issue tracking by design, so wiring either one ships a picker that lists
  nothing forever.
- `RemoteHostKind` deliberately has no `'bitbucket'`. Adding it breaks the
  `never` check in `resolveSessionStudioOpenEvent` and `remoteHost.test.ts`.
- The mobile companion's `fetchIssuesFor` and `resolveIssueForSession` are
  exhaustive switches over `WorkspaceIntegrationProvider` with a `never`
  checked default, and neither falls through to another provider:
  `fetchIssuesFor` returns `[]` where there is no mobile fetch, and
  `resolveIssueForSession` throws a named refusal. The gating lists
  (`ALL_ISSUE_PROVIDERS`, `CREATE_SESSION_PROVIDERS`) are hand-enumerated
  separately from those switches, so the compiler forces a switch arm for a
  new provider while nothing forces a gating-list entry. A provider can
  compile clean and stay silently absent from mobile issue queries and
  session creation. Add it to both.
- `pending_resolutions` is a transient push queue, not a durable verdict log.
  Making it durable was investigated and rejected; the durable source is
  message replay through `hydrateResolverOutcomes`.
- `LENS_KINDS` is a hand-maintained set whose only consumer is
  `readPersistedLens`. A missing entry breaks lens restore silently, with no
  compile error.
- `LinkedPrChip` and `NewSessionView` read `[data-studio-overlay]` out of the
  DOM. Do not tidy this without first centralizing fullscreen-studio state:
  `sessionStudio` tracks three kinds and `StudioShell` backs seventeen
  studios, and the sniff is what bridges them.

## Traps in the toolchain

- A new worktree needs `pnpm install`, and that install exits 1 at the
  `prepare` step: lefthook refuses when `core.hooksPath` points at the shared
  `.git/hooks`. It is harmless. Dependencies and native bindings install
  before `prepare`, so check that `node_modules` and `better_sqlite3.node`
  exist and carry on. Do not repoint `core.hooksPath`.
- A worktree installed with `--ignore-scripts` has no `better-sqlite3`
  bindings, so `@goodboy/db` tests error out and a green run covers only the
  desktop package.
- Turbo caches are shared across worktrees, so a `FULL TURBO` green can be a
  sibling's replayed log rather than a run. When the green has to mean
  something, `pnpm exec turbo run test --force` and a log line reading
  `0 cached`.
- Neither `ci.yml` nor `rust.yml` has a `workflow_dispatch` trigger. When a
  run was never dispatched, closing and reopening the PR is the only way to
  summon one.
