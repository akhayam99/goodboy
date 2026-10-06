import { useMemo } from 'react';
import type { Agent, ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ReviewEntry } from '../../components/ReviewFlow/useReviewEntries';
import { laneStatusOf, type LaneStatus } from '../../laneStatus';

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const EMPTY_AGENTS: ReadonlyArray<Agent> = [];

export const useLaneStatus = ({
  sessionId,
  entries,
}: {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
}): LaneStatus | null => {
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  return useMemo(() => laneStatusOf({ attempts, agents, entries }), [agents, attempts, entries]);
};
