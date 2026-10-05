import type { OpenQuestion, ResolveAttempt } from '@goodboy/types';

export const openQuestionOfThread = ({
  questions,
  attempts,
  threadId,
  question,
}: {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly threadId: string;
  readonly question: string | null;
}): OpenQuestion | undefined => {
  const agentIds = new Set(
    attempts.filter((attempt) => attempt.threadIds.includes(threadId)).map((a) => a.agentId),
  );
  return questions.find(
    (item) =>
      item.status === 'open' &&
      item.text === question &&
      item.createdByAgentId !== undefined &&
      agentIds.has(item.createdByAgentId),
  );
};
