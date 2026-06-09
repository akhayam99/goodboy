import { useEffect } from 'react';
import { useAppStore, useSessions } from '../../../../store';

const POLL_INTERVAL_MS = 5 * 60_000;

export const useGithubPolling = (): void => {
  const sweepGithub = useAppStore((s) => s.sweepGithub);
  const githubAvailable = useAppStore((s) => s.githubStatus?.available ?? false);
  const sessions = useSessions();
  const branchSignature = useAppStore((s) => {
    let acc = '';
    for (const session of sessions) {
      const branch = s.sessionBranches[session.id] ?? '';
      acc += `${session.id}@${branch};`;
    }
    return acc;
  });

  useEffect(() => {
    sweepGithub();
  }, [sweepGithub, githubAvailable, branchSignature]);

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
