import type { Agent, HandoffSender, OpenQuestionId, Step, WorkflowRun } from '@goodboy/types';
import type { AgentKind } from '../../../features/session/agent-kind';
import { agentFollowUpMoves } from '../../../features/session/components/AgentDetailPane/followUpMoves';

type Params = {
  readonly agent: Agent | null;
  readonly agentKind: AgentKind;
  readonly parent: Agent | null;
  readonly parentKind: AgentKind | null;
  readonly workflowRun: WorkflowRun | null;
  readonly step: Step | null;
  readonly steps: ReadonlyArray<Step>;
  readonly prNumber: number | null;
};

type ThreadIdsParams = {
  readonly agent: Agent | null;
};

const threadIdsOf = ({ agent }: ThreadIdsParams): ReadonlyArray<string> => {
  if (agent === null) {
    return [];
  }
  if (agent.sourceThreadIds !== undefined && agent.sourceThreadIds.length > 0) {
    return agent.sourceThreadIds;
  }
  return agent.sourceThreadId === undefined ? [] : [agent.sourceThreadId];
};

export const deriveHandoffSender = ({
  agent,
  agentKind,
  parent,
  parentKind,
  workflowRun,
  step,
  steps,
  prNumber,
}: Params): HandoffSender => {
  if (agentKind === 'resolver') {
    return { kind: 'resolve', threadIds: threadIdsOf({ agent }), prNumber };
  }
  if (agent?.sourceKind === 'open_question' && agent.sourceThreadId !== undefined) {
    return { kind: 'question', questionId: agent.sourceThreadId as OpenQuestionId };
  }
  if (parent !== null) {
    const isFollowUp =
      parentKind !== null &&
      agentFollowUpMoves({ sourceKind: parentKind }).some((move) => move.kind === agentKind);
    return isFollowUp
      ? { kind: 'followUp', sourceAgentId: parent.id }
      : { kind: 'parent', parentAgentId: parent.id, label: '' };
  }
  if (step !== null && workflowRun !== null) {
    const ordered = [...steps].sort((a, b) => a.ordinal - b.ordinal);
    const position = ordered.findIndex((candidate) => candidate.id === step.id) + 1;
    const stepOrdinal = position > 0 ? position : step.ordinal + 1;
    return workflowRun.executionMode === 'dynamic'
      ? { kind: 'orchestrator', workflowRunId: workflowRun.id, stepOrdinal }
      : {
          kind: 'workflowStep',
          workflowRunId: workflowRun.id,
          stepOrdinal,
          stepCount: ordered.length,
        };
  }
  return { kind: 'you' };
};
