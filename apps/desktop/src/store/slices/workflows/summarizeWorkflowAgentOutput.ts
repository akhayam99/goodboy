import { fallbackStepOutputSummary, resolveTaskModel } from '@goodboy/core';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { shortModel } from '../../../features/session/agent-row-format';
import { stepForAgent } from '../../../features/workflows/stepForAgent';
import { summarizeAgentOutput } from '../../summarizeAgentOutput';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly output: string;
};

export const summarizeWorkflowAgentOutput = async ({
  get,
  sessionId,
  agent,
  output,
}: Params): Promise<string> => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  if (session == null) {
    return fallbackStepOutputSummary({ output });
  }
  const taskModel = resolveTaskModel(
    'summarizer',
    get().workspaceOverrides?.[session.workspaceId]?.taskModels,
    session.providerPreference.defaultProvider,
  );
  const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
  const expectedOutput =
    stepForAgent({
      agent,
      workflowRuns: session.workflowRuns,
      workflows: [
        ...(get().phaseTemplates?.[session.workspaceId] ?? []),
        ...(get().sessionWorkflows?.[sessionId] ?? []),
      ],
    })?.expectedOutput ?? '';
  const result = await summarizeAgentOutput({
    agentId: agent.id,
    output,
    taskModel,
    ...(worktreePath != null && { workingDir: worktreePath }),
    ...(expectedOutput !== '' && { expectedOutput }),
  });
  if (!result.degraded) {
    return result.summary;
  }
  const modelLabel = `${taskModel.providerId}/${shortModel(taskModel.model)}`;
  const workflowRunId = agent.workflowRunId;
  const stepId = agent.stepId;
  const coalesceKey =
    workflowRunId != null && stepId != null
      ? `step-summary-degraded:${workflowRunId}:${stepId}`
      : `step-summary-degraded:${agent.id}`;
  void get().emitNotification(
    'summarizer-degraded',
    'warning',
    `step summary degraded: ${agent.name}`,
    `${modelLabel}: ${result.error ?? 'summarization failed'}`,
    {
      sessionId,
      action: { kind: 'retry-step-summary', sessionId, agentId: agent.id as AgentId },
      coalesceKey,
    },
  );
  return result.summary;
};
