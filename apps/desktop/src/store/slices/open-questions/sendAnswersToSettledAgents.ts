import type { AgentId, OpenQuestion, SessionId } from '@goodboy/types';
import { markOpenQuestionAnswersDelivered } from '@goodboy/db';
import { wrapOpenQuestionAnswers } from '@goodboy/core/context';
import { tauriDatabase } from '../../../shared/lib/db';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import { answersInFlight } from './answersInFlight';
import type { GetFn } from './types';

export type AskingAgentId = AgentId | null;

type SendAnswersToSettledAgentsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly askingAgentIds: ReadonlySet<AskingAgentId>;
};

type DeliverParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AskingAgentId;
  readonly questions: ReadonlyArray<OpenQuestion>;
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

const deliverToAgent = async ({
  get,
  sessionId,
  agentId,
  questions,
}: DeliverParams): Promise<void> => {
  throwIfRefused({
    result: await get().sendTurn({
      sessionId,
      content: wrapOpenQuestionAnswers(buildBatchPrompt(questions)),
      agentId: agentId ?? undefined,
    }),
  });
  await markOpenQuestionAnswersDelivered({
    db: tauriDatabase,
    ids: questions.map((question) => question.id),
  });
};

export const sendAnswersToSettledAgents = async ({
  get,
  sessionId,
  askingAgentIds,
}: SendAnswersToSettledAgentsParams): Promise<void> => {
  const stillOpen = get().sessionOpenQuestions[sessionId] ?? [];
  const answered = get().sessionAnsweredQuestions[sessionId] ?? [];
  const failures: unknown[] = [];
  let hasDelivered = false;
  answersInFlight.begin({ sessionId });
  try {
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
      try {
        await deliverToAgent({ get, sessionId, agentId, questions: undelivered });
        hasDelivered = true;
      } catch (error) {
        failures.push(error);
      }
    }
    if (hasDelivered) {
      await get().loadSessionAnsweredQuestions(sessionId);
    }
  } finally {
    answersInFlight.end({ sessionId });
  }
  const [failure] = failures;
  if (failure !== undefined) {
    throw failure;
  }
};
