import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import type { RowPhase } from '../../../workTreeModel/rowState';
import type { WorkTime } from '../../../workTreeModel/workTime';
import type { AgentKind } from '../../agent-kind';
import { useAgentRowWork } from '../useAgentRowWork';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly status: Agent['status'];
  readonly isWaitingOnYou: boolean;
};

type PhaseParams = Pick<Params, 'status' | 'isWaitingOnYou'>;

const detailPhase = ({ status, isWaitingOnYou }: PhaseParams): RowPhase => {
  if (isWaitingOnYou) {
    return 'waiting';
  }
  switch (status) {
    case 'running':
      return 'running';
    case 'pending':
      return 'queued';
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};

export const useAgentDetailWorkTime = ({
  session,
  agent,
  kind,
  status,
  isWaitingOnYou,
}: Params): WorkTime | null | undefined => {
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const roleModels = useSessionRoleModels({ sessionId: session.id });
  const step = useMemo(() => {
    if (agent.workflowRunId == null || agent.stepId == null || agent.parentAgentId != null) {
      return null;
    }
    const attached = attachedRuns.find(({ run }) => run.id === agent.workflowRunId) ?? null;
    return attached?.workflow.steps.find((candidate) => candidate.id === agent.stepId) ?? null;
  }, [agent.parentAgentId, agent.stepId, agent.workflowRunId, attachedRuns]);
  return useAgentRowWork({
    agent,
    kind,
    step,
    roleModels,
    sessionProvider: session.providerPreference?.defaultProvider ?? null,
    sessionEffort: session.effort ?? null,
    phase: detailPhase({ status, isWaitingOnYou }),
  }).time;
};
