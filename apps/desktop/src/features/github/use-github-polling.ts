import { useEffect } from 'react';
import { useAppStore, useSessions } from '../../store';

// Interim PR polling until a GitHub webhook lands. Five minutes is a
// deliberate floor: the on-access and on-workspace-switch sweeps already
// cover "I just looked at it", so the timer only refreshes cards the user is
// watching passively.
const POLL_INTERVAL_MS = 5 * 60_000;

export function useGithubPolling(): void {
  const sweepGithub = useAppStore((s) => s.sweepGithub);
  const githubAvailable = useAppStore((s) => s.githubStatus?.available ?? false);
  const sessions = useSessions();
  const sessionBranches = useAppStore((s) => s.sessionBranches);

  // Reactive sweep — boot, workspace switch, and session-list / branch
  // changes: `sessions` and `sessionBranches` are replaced (fresh identity)
  // on each, so this re-runs exactly when the set of PRs to poll changes.
  // Full scope (no `skipUnknownPr`) so a session whose PR was created from
  // outside the app — `gh pr create` in a terminal, web UI, etc. — gets
  // discovered the first time we see it.
  useEffect(() => {
    sweepGithub();
  }, [sweepGithub, githubAvailable, sessions, sessionBranches]);

  // Steady-state poll. The tick no-ops while the window is hidden; returning
  // to the foreground fires an immediate catch-up. Incremental scope: skip
  // sessions we already learned have no PR — the app's PR-creation paths
  // (createPrForSession, assistant-text URL detect, summarizer hook) refresh
  // them explicitly, so the timer doesn't need to.
  useEffect(() => {
    const sweepIfVisible = (): void => {
      if (document.visibilityState === 'visible') sweepGithub({ skipUnknownPr: true });
    };
    const intervalId = window.setInterval(sweepIfVisible, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', sweepIfVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', sweepIfVisible);
    };
  }, [sweepGithub]);
}
