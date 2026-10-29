import type { OpenQuestion } from '@goodboy/types';

type Params = {
  readonly questions: ReadonlyArray<OpenQuestion>;
};

export const askingAgentBatch = ({ questions }: Params): ReadonlyArray<OpenQuestion> => {
  const ordered = [...questions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const first = ordered[0];
  if (first === undefined) {
    return [];
  }
  const agentId = first.createdByAgentId ?? null;
  return ordered.filter((question) => (question.createdByAgentId ?? null) === agentId);
};
