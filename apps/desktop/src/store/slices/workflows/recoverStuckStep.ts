import { classifyWorkflowChain, findReusableAgent, runsForWorkflowRun } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { composeStepBoundary } from '../../kickoff';
import type { GetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

const recoveryPrompt = ({
  agentId,
}: {
  readonly agentId: Parameters<typeof composeStepBoundary>[0];
}): string =>
  [
    'Check whether this workflow step is complete.',
    'If work remains, finish it. If the work is complete, briefly confirm the result.',
    composeStepBoundary(agentId),
  ].join('\n');

export const recoverStuckStep = (get: GetFn) => {
  return async ({ sessionId, workflowRunId }: Params): Promise<void> => {
    try {
      const session = get().sessions.find((candidate) => candidate.id === sessionId);
      if (session == null) {
        return;
      }
      const run = session.workflowRuns.find((candidate) => candidate.id === workflowRunId);
      if (run == null || run.discardedAt != null) {
        return;
      }
      const workflows = [
        ...(get().phaseTemplates[session.workspaceId] ?? []),
        ...(get().sessionWorkflows?.[sessionId] ?? []),
      ];
      const workflow = workflows.find((candidate) => candidate.id === run.workflowId);
      if (workflow == null) {
        return;
      }
      const agents = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId);
      const chain = classifyWorkflowChain(workflow, agents);
      if (chain.kind !== 'blocked') {
        return;
      }
      const agent = findReusableAgent(agents, chain.failedStep.id);
      if (agent == null || agent.status !== 'failed') {
        return;
      }
      const turn = get().agentTurnState[agent.id];
      if (turn?.kind === 'running' || turn?.kind === 'starting') {
        return;
      }
      await get().sendTurn({
        sessionId,
        agentId: agent.id,
        content: recoveryPrompt({ agentId: agent.id }),
      });
    } catch (error) {
      void get().emitNotification(
        'error',
        'warning',
        'the blocked step could not be checked',
        `${formatError(error)}. You can still skip this step.`,
        { sessionId },
      );
    }
  };
};
