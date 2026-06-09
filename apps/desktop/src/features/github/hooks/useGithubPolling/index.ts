import { useEffect } from 'react';
import { useAppStore, useSessions } from '../../../../store';

// Interim PR polling until a GitHub webhook lands. Five minutes is a
// deliberate floor: the on-access and on-workspace-switch sweeps already
// cover "I just looked at it", so the timer only refreshes cards the user is
// watching passively.
const POLL_INTERVAL_MS = 5 * 60_000;

export const useGithubPolling = (): void => {
  const sweepGithub = useAppStore((s) => s.sweepGithub);
  const githubAvailable = useAppStore((s) => s.githubStatus?.available ?? false);
  const sessions = useSessions();
  // Why we derive a *signature* instead of subscribing to `sessionBranches`
  // directly: the raw map's identity changes on every branch reconcile
  // (typed once per summarizer tick, per session). Subscribing to it forced
  // a full sweep on every keystroke an agent typed into its worktree's git
  // log. The signature collapses to the set of (sessionId, branch) pairs
  // that actually exist, exactly when "the set of PRs to poll" changes.
  const branchSignature = useAppStore((s) => {
    let acc = '';
    for (const session of sessions) {
      const branch = s.sessionBranches[session.id] ?? '';
      acc += `${session.id}@${branch};`;
    }
    return acc;
  });

  // Reactive sweep, boot, workspace switch, and session-list / branch
  // changes. Full scope (no `skipUnknownPr`) so a session whose PR was
  // created outside the app (`gh pr create`, web UI) gets discovered.
  useEffect(() => {
    sweepGithub();
  }, [sweepGithub, githubAvailable, branchSignature]);

  // Steady-state poll. The tick no-ops while the window is hidden; returning
  // to the foreground fires an immediate catch-up. Incremental scope: skip
  // sessions we already learned have no PR, the app's PR-creation paths
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
};
