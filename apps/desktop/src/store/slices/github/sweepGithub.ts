import type { GetFn, SetFn } from './types';

type Params = { skipUnknownPr?: boolean };

// Interim PR auto-refresh until a GitHub webhook lands. Sweeps every
// session held in `state.sessions` (the active workspace's): head for all,
// detail for the one whose card is open. Each refresh is silent with one
// retry, polling errors don't deserve UI, transient gh failures get a
// second chance. No `force`, the 60s/30s caches absorb overlapping
// sweep / on-access / manual refreshes.
//
// Filters:
//   - terminal PRs (merged/closed) → no new commits, CI, or reviews can
//     land. On-access still refreshes them so reopening shows current.
//   - `skipUnknownPr` → set by the steady-state interval. Sessions where
//     we already learned there's no PR (`pr === null` post-fetch) get
//     skipped, since the in-app PR-creation paths (`createPrForSession`
//     + the assistant-text URL detector + the summarizer hook) refresh
//     them explicitly. The reactive sweep (boot / workspace switch /
//     new session) still polls them once so PRs created from outside
//     the app are discovered.
// (Archived sessions are not in `state.sessions` by construction, they
// live in `archivedSessions[workspaceId]` and are out of the poll loop.)
export const sweepGithub = (_set: SetFn, get: GetFn) => {
  return (opts?: Params) => {
    if (!get().githubStatus?.available) return;
    const { sessions, sessionBranches, sessionGithub, currentSessionId } = get();
    const subOpts = { silent: true, retries: 1 } as const;
    for (const session of sessions) {
      if (!sessionBranches[session.id]) continue;
      const cached = sessionGithub[session.id];
      const pr = cached?.pr;
      if (pr && (pr.state === 'merged' || pr.state === 'closed')) continue;
      if (opts?.skipUnknownPr && cached?.fetchedAt && pr === null) continue;
      const head = get().refreshSessionPr(session.id, subOpts);
      if (session.id === currentSessionId) {
        void head.then(() => get().refreshSessionPrDetail(session.id, subOpts));
      }
    }
  };
};
