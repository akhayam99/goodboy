import type {
  AgentId,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { markOpenQuestionAnswersDelivered } from '@goodboy/db';
import { wrapOpenQuestionAnswers } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { findWorkflowRun } from '../workflows/findWorkflowRun';
import { isQuestionHeldByStop } from './isQuestionHeldByStop';
import type { GetFn } from './types';

export type AskingAgentId = AgentId | null;

type DeliveredRun = {
  readonly id: WorkflowRunId;
  readonly isStopIgnored: boolean;
};

type SendAnswersToSettledAgentsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly askingAgentIds: ReadonlySet<AskingAgentId>;
  readonly run?: DeliveredRun;
};

type RunLiveParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly run: DeliveredRun;
};

const isRunLive = ({ get, sessionId, run }: RunLiveParams): boolean => {
  const live = findWorkflowRun({ get, sessionId, workflowRunId: run.id });
  return (
    live != null &&
    live.discardedAt == null &&
    (run.isStopIgnored || live.orchestrationStop == null)
  );
};

const askingAgentOf = (question: OpenQuestion): AskingAgentId => question.createdByAgentId ?? null;

const AGENT_PROVENANCE =
  "  Source: an agent answered this on the user's behalf. Treat it as the user's own answer.";

const buildBatchPrompt = (questions: ReadonlyArray<OpenQuestion>): string => {
  const lines = ['Answers to open questions:'];
  for (const question of questions) {
    lines.push(`\n- Q: ${question.text}`);
    lines.push(`  A: ${question.userAnswer ?? ''}`);
    if (question.answerSource === 'agent') {
      lines.push(AGENT_PROVENANCE);
    }
  }
  return lines.join('\n');
};

export const sendAnswersToSettledAgents = async ({
  get,
  sessionId,
  askingAgentIds,
  run,
}: SendAnswersToSettledAgentsParams): Promise<void> => {
  const stillOpen = get().sessionOpenQuestions[sessionId] ?? [];
  const answered = get().sessionAnsweredQuestions[sessionId] ?? [];
  const delivered: OpenQuestionId[] = [];

  for (const agentId of askingAgentIds) {
    const hasOpenLeft = stillOpen.some((question) => askingAgentOf(question) === agentId);
    if (hasOpenLeft) {
      continue;
    }
    if (run !== undefined && !isRunLive({ get, sessionId, run })) {
      break;
    }
    const undelivered = answered.filter(
      (question) =>
        askingAgentOf(question) === agentId &&
        question.answerDeliveredAt === undefined &&
        question.userAnswer !== null &&
        (run === undefined
          ? !isQuestionHeldByStop({ get, sessionId, question })
          : question.workflowRunId === run.id),
    );
    if (undelivered.length === 0) {
      continue;
    }
    await get().sendTurn({
      sessionId,
      content: wrapOpenQuestionAnswers(buildBatchPrompt(undelivered)),
      agentId: agentId ?? undefined,
    });
    delivered.push(...undelivered.map((question) => question.id));
  }

  if (delivered.length === 0) {
    return;
  }
  await markOpenQuestionAnswersDelivered({ db: tauriDatabase, ids: delivered });
  await get().loadSessionAnsweredQuestions(sessionId);
};
