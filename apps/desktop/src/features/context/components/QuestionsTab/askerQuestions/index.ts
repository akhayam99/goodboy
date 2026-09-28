import type { AgentId, OpenQuestion, OpenQuestionId } from '@goodboy/types';

export type AskerId = AgentId | null;

export const askerOf = (question: OpenQuestion): AskerId => question.createdByAgentId ?? null;

type Params = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly askerId: AskerId;
};

export const askerQuestions = ({ questions, askerId }: Params): ReadonlyArray<OpenQuestion> =>
  questions.filter((question) => askerOf(question) === askerId);

type StagedParams = {
  readonly group: ReadonlyArray<OpenQuestion>;
  readonly staged: ReadonlyArray<OpenQuestionId>;
};

export const isGroupStaged = ({ group, staged }: StagedParams): boolean =>
  group.length > 0 && group.every((question) => staged.includes(question.id));
