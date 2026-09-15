import type { Session, SessionId } from '@goodboy/types';
import { classifyWorkflowChain, findReusableAgent, runsForWorkflowRun } from '@goodboy/core';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { resolveRootAgent } from '../../../../session/agent-kind';
import { useSelectedWorkflowRun } from '../../../../session/hooks/useSelectedWorkflowRun';
import { WorkflowAdvance } from '../../../../workflows/components/WorkflowAdvance';

type Props = {
  readonly session: Session;
};

export const WorkflowAdvanceRow = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const phaseRuns = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const selectedWorkflowRun = useSelectedWorkflowRun({ session });

  if (selectedWorkflowRun == null || selectedWorkflowRun.run.discardedAt != null) {
    return null;
  }

  const stepAgents = runsForWorkflowRun(phaseRuns, selectedWorkflowRun.run.id).filter(
    (agent) => agent.parentAgentId == null && agent.stepId != null,
  );
  const chain = classifyWorkflowChain(selectedWorkflowRun.workflow, stepAgents);
  const actingAgent =
    chain.kind === 'blocked'
      ? findReusableAgent(stepAgents, chain.failedStep.id)
      : chain.kind === 'step'
        ? (stepAgents.find(
            (agent) => agent.stepId === chain.step.id && agent.status === 'pending',
          ) ?? null)
        : null;

  if (actingAgent == null) {
    return null;
  }
  const selectedRootAgent =
    selectedAgentId != null
      ? resolveRootAgent({ agents: phaseRuns, agentId: selectedAgentId })
      : null;
  const isActingChat =
    actingAgent.id === selectedAgentId || actingAgent.id === selectedRootAgent?.id;
  if (!isActingChat) {
    return null;
  }

  return (
    <WorkflowAdvance
      sessionId={sessionId}
      run={selectedWorkflowRun.run}
      workflow={selectedWorkflowRun.workflow}
    />
  );
};
