import type { AgentId, OpenQuestion } from '@goodboy/types';

export const askingAgentIdsOf = ({
  questions,
}: {
  readonly questions: ReadonlyArray<OpenQuestion>;
}): ReadonlySet<AgentId> =>
  new Set<AgentId>(
    questions.flatMap((question) =>
      question.status === 'open' && question.createdByAgentId != null
        ? [question.createdByAgentId]
        : [],
    ),
  );
