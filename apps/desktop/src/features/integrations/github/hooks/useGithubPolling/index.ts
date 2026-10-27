import { useEffect } from 'react';
import { usePoll } from '../../../../../shared/lib/usePoll';
import { useAppStore, useSessions } from '../../../../../store';

const POLL_INTERVAL_MS = 5 * 60_000;

export const useGithubPolling = (): void => {
  const sweepRequests = useAppStore((s) => s.sweepRequests);
  const githubAvailable = useAppStore((s) => s.githubStatus?.available ?? false);
  const hostBindingSignature = useAppStore((s) =>
    Object.values(s.workspaceIntegrations)
      .flat()
      .filter((binding) => binding.provider === 'gitlab' || binding.provider === 'bitbucket')
      .map((binding) => binding.id)
      .join(';'),
  );
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
    void sweepRequests();
  }, [sweepRequests, githubAvailable, hostBindingSignature, branchSignature]);

  usePoll({
    run: () => sweepRequests({ shouldSkipUnknownRequest: true }),
    everyMs: POLL_INTERVAL_MS,
    isImmediate: false,
  });
};
