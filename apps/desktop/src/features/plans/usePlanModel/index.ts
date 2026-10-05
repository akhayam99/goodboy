import { useMemo } from 'react';
import type { Agent, ArtifactId, PlanWithCount, SessionArtifact, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions, useSessionPlans } from '../../../store';
import { artifactStateOf, type ArtifactState } from '../../artifacts/artifactStateOf';
import type { PlanPartRow } from '../components/PlanParts/planPartRows';
import { usePlanPartRows } from '../components/PlanParts/usePlanPartRows';
import type { PlanRevising } from '../planRevising';
import { planStateInputsOf } from '../planStateInputs';
import { usePlanRevising } from '../useRevisingPlans';

export type PlanModel = Readonly<{
  plan: PlanWithCount;
  stored: SessionArtifact | null;
  version: number;
  revising: PlanRevising;
  state: ArtifactState | null;
  rows: ReadonlyArray<PlanPartRow>;
  agents: ReadonlyArray<Agent>;
  hasRun: boolean;
}>;

type Params = Readonly<{
  sessionId: SessionId;
  planId: ArtifactId;
}>;

export const usePlanModel = ({ sessionId, planId }: Params): PlanModel | null => {
  const plans = useSessionPlans(sessionId);
  const artifacts = useAppStore(
    (s) => s.sessionArtifacts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionArtifact>),
  );
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const openQuestionCount = useSessionOpenQuestions(sessionId).length;
  const revising = usePlanRevising({ sessionId, planId });
  const plan = plans.find((candidate) => candidate.id === planId) ?? null;
  const stored = artifacts.find((candidate) => candidate.id === planId) ?? null;
  const rows = usePlanPartRows({ sessionId, plan, agents });

  return useMemo((): PlanModel | null => {
    if (plan === null) {
      return null;
    }
    return {
      plan,
      stored,
      version: stored?.revision ?? 1,
      revising,
      state: artifactStateOf({
        kind: 'plan',
        status: plan.status,
        isNew: false,
        openQuestionCount,
        ...planStateInputsOf({ plan, rows, revising }),
      }),
      rows,
      agents,
      hasRun: plan.consumptionCount > 0,
    };
  }, [plan, stored, revising, openQuestionCount, rows, agents]);
};
