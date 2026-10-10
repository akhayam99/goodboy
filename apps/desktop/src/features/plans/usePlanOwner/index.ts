import { useMemo } from 'react';
import type { Agent, PlanWithCount, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { planOwnerOf } from '../planOwnerOf';

type Params = Readonly<{
  sessionId: SessionId;
  plan: Pick<PlanWithCount, 'agentId' | 'workflowRunId'> | null;
}>;

export const usePlanOwner = ({ sessionId, plan }: Params): WorkflowRun | null => {
  const agents = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const runs = useAppStore(
    (state) =>
      sessionById(state.sessions, sessionId)?.workflowRuns ??
      (EMPTY_ARRAY as ReadonlyArray<WorkflowRun>),
  );
  const templates = useAppStore((state) => {
    const session = sessionById(state.sessions, sessionId);
    if (session === undefined) {
      return EMPTY_ARRAY as ReadonlyArray<Workflow>;
    }
    return state.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>);
  });

  return useMemo(
    () => (plan === null ? null : planOwnerOf({ plan, agents, runs, templates })),
    [plan, agents, runs, templates],
  );
};
