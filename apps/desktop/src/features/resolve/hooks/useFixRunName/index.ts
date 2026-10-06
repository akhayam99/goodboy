import { useMemo } from 'react';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { fixRunNameOf } from '../../fixRun';

const NO_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

export const useFixRunName = ({
  sessionId,
  agentId,
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
}): string | null => {
  const attempts = useAppStore((state) => state.sessionResolveAttempts?.[sessionId]) ?? NO_ATTEMPTS;
  return useMemo(() => fixRunNameOf({ attempts, agentId }), [attempts, agentId]);
};
