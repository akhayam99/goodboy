import { useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, ArtifactId, SessionArtifact, SessionId, TurnState } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import {
  NOT_REVISING,
  revisingByPlanId,
  sameRevisingMaps,
  type PlanRevising,
} from '../planRevising';

const NO_REVISING: ReadonlyMap<ArtifactId, PlanRevising> = new Map();

export const useRevisingPlans = (sessionId: SessionId): ReadonlyMap<ArtifactId, PlanRevising> => {
  const artifacts = useAppStore(
    (s) => s.sessionArtifacts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionArtifact>),
  );
  const plannerIds = useMemo(
    () => [
      ...new Set(
        artifacts
          .filter((artifact) => artifact.kind === 'plan')
          .map((artifact) => artifact.agentId),
      ),
    ],
    [artifacts],
  );
  const turns = useAppStore(useShallow((s) => plannerIds.map((id) => s.agentTurnState[id])));
  const previous = useRef<ReadonlyMap<ArtifactId, PlanRevising>>(NO_REVISING);
  const next = useMemo(() => {
    const turnStates: Partial<Record<AgentId, TurnState>> = {};
    plannerIds.forEach((id, index) => {
      turnStates[id] = turns[index];
    });
    return revisingByPlanId({ artifacts, turnStates });
  }, [artifacts, plannerIds, turns]);
  if (sameRevisingMaps(previous.current, next)) {
    return previous.current;
  }
  previous.current = next;
  return next;
};

export const usePlanRevising = ({
  sessionId,
  planId,
}: {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId | null;
}): PlanRevising => {
  const revising = useRevisingPlans(sessionId);
  return planId === null ? NOT_REVISING : (revising.get(planId) ?? NOT_REVISING);
};
