import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { usePoll } from '../../../../../shared/lib/usePoll';
import { useAppStore, useSessions } from '../../../../../store';
import { branchSignatureOf } from './branchSignatureOf';
import { changedBranchSessions } from './changedBranchSessions';
import { parseBranchSignature } from './parseBranchSignature';

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
  const branchSignature = useAppStore((s) =>
    branchSignatureOf({ sessions, branches: s.sessionBranches }),
  );
  const knownBranches = useRef<ReadonlyMap<SessionId, string> | null>(null);

  useEffect(() => {
    void sweepRequests({ isCurrentFirst: true });
  }, [sweepRequests, githubAvailable, hostBindingSignature]);

  useEffect(() => {
    const next = parseBranchSignature({ signature: branchSignature });
    const previous = knownBranches.current;
    knownBranches.current = next;
    if (previous === null) {
      return;
    }
    const changed = changedBranchSessions({ previous, next });
    if (changed.length === 0) {
      return;
    }
    if (changed.length > 1) {
      void sweepRequests();
      return;
    }
    const [sessionId] = changed;
    if (sessionId !== undefined) {
      void sweepRequests({ sessionId });
    }
  }, [sweepRequests, branchSignature]);

  usePoll({
    run: () => sweepRequests({ shouldSkipUnknownRequest: true }),
    everyMs: POLL_INTERVAL_MS,
    isImmediate: false,
  });
};
