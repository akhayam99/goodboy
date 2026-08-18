import { useMemo } from 'react';
import type { Agent, AgentId, Session, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { resolveRootAgent } from '../../agent-kind';

type Params = {
  readonly session: Session;
};

export type SelectedWorkflowRun = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const useSelectedWorkflowRun = ({ session }: Params): SelectedWorkflowRun | null => {
  const sessionId = session.id as SessionId;
  const selectedAgentId = useAppStore(
    (state) => state.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const attachedRuns = useAttachedWorkflowRuns({ session });

  return useMemo(() => {
    if (selectedAgentId == null) {
      return null;
    }
    const rootAgent = resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId });
    const workflowRunId = rootAgent?.workflowRunId ?? null;
    if (workflowRunId == null) {
      return null;
    }
    return attachedRuns.find(({ run }) => run.id === workflowRunId) ?? null;
  }, [attachedRuns, phaseRuns, selectedAgentId]);
};
