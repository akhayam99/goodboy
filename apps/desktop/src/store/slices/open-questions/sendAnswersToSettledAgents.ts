import type { AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import { markOpenQuestionAnswersDelivered } from '@goodboy/db';
import { wrapOpenQuestionAnswers } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

export type AskingAgentId = AgentId | null;

export type SendAnswersToSettledAgentsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly askingAgentIds: ReadonlySet<AskingAgentId>;
};

const askingAgentOf = (question: OpenQuestion): AskingAgentId => question.createdByAgentId ?? null;

const buildBatchPrompt = (questions: ReadonlyArray<OpenQuestion>): string => {
  const lines = ['Answers to open questions:'];
  for (const question of questions) {
    lines.push(`\n- Q: ${question.text}`);
    lines.push(`  A: ${question.userAnswer ?? ''}`);
  }
  return lines.join('\n');
};

export const sendAnswersToSettledAgents = async ({
  get,
  sessionId,
  askingAgentIds,
}: SendAnswersToSettledAgentsParams): Promise<void> => {
  const stillOpen = get().sessionOpenQuestions[sessionId] ?? [];
  const answered = get().sessionAnsweredQuestions[sessionId] ?? [];
  const delivered: OpenQuestionId[] = [];

  for (const agentId of askingAgentIds) {
    const hasOpenLeft = stillOpen.some((question) => askingAgentOf(question) === agentId);
    if (hasOpenLeft) {
      continue;
    }
    const undelivered = answered.filter(
      (question) =>
        askingAgentOf(question) === agentId &&
        question.answerDeliveredAt === undefined &&
        question.userAnswer !== null,
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
