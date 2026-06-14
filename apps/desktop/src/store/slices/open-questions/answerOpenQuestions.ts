import type { AgentId, OpenQuestionId, SessionId } from '@goodboy/types';
import { markOpenQuestionAnswered } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type AnswerPair = {
  readonly id: OpenQuestionId;
  readonly text: string;
  readonly answer: string;
};

function buildBatchPrompt(pairs: ReadonlyArray<AnswerPair>): string {
  const lines = ['Answers to open questions:'];
  for (const { text, answer } of pairs) {
    lines.push(`\n- Q: ${text}`);
    lines.push(`  A: ${answer}`);
  }
  return lines.join('\n');
}

export const answerOpenQuestions = (get: GetFn) => {
  return async (
    sessionId: SessionId,
    pairs: ReadonlyArray<AnswerPair>,
    targetAgentId: AgentId | null,
  ) => {
    const valid = pairs.filter((p) => p.answer.trim().length > 0);
    if (valid.length === 0) {
      return;
    }

    await Promise.all(valid.map((p) => markOpenQuestionAnswered(tauriDatabase, p.id, p.answer)));
    const slotChanged = await removeQuestionsFromSlot(
      tauriDatabase,
      sessionId,
      valid.map((p) => p.text),
    );
    await get().loadSessionOpenQuestions(sessionId);
    await get().loadSessionAnsweredQuestions(sessionId);
    if (slotChanged) {
      await get().loadSessionSlots(sessionId);
    }

    await get().sendTurn({
      sessionId,
      content: buildBatchPrompt(valid),
      agentId: targetAgentId ?? undefined,
    });
  };
};
