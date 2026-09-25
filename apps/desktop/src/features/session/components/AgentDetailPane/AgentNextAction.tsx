import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveRootAgent } from '../../agent-kind';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { NextActionStrip } from '../../../workflows/components/NextActionStrip';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
};

export const AgentNextAction = ({ session, agent }: Props) => {
  const phaseRuns = useAppStore(
    (state) => state.sessionPhaseRuns[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const root = resolveRootAgent({ agents: phaseRuns, agentId: agent.id }) ?? agent;
  const attached =
    root.workflowRunId != null
      ? (attachedRuns.find(({ run }) => run.id === root.workflowRunId) ?? null)
      : null;
  if (attached == null) {
    return null;
  }
  return (
    <NextActionStrip
      sessionId={session.id}
      run={attached.run}
      workflow={attached.workflow}
      subjectAgentId={root.id}
    />
  );
};
