import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { resolveRootAgent } from '../../../agent-kind';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
};

export const useAgentNextRun = ({ session, agent }: Params) => {
  const phaseRuns: ReadonlyArray<Agent> = useAppStore(
    (state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY,
  );
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const root = resolveRootAgent({ agents: phaseRuns, agentId: agent.id }) ?? agent;
  const attached =
    root.workflowRunId != null
      ? (attachedRuns.find(({ run }) => run.id === root.workflowRunId) ?? null)
      : null;
  return attached === null ? null : { root, attached };
};
