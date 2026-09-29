import type { Agent, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { partitionDelegatedQuestions } from '../../../../context/questionDelegate';

type QuestionRowKind = 'waiting' | 'delegated' | 'staged' | 'dismissed' | 'answered';

export type QuestionRow = {
  readonly question: OpenQuestion;
  readonly kind: QuestionRowKind;
};

export type QuestionsLensModel = {
  readonly waiting: ReadonlyArray<QuestionRow>;
  readonly delegated: ReadonlyArray<QuestionRow>;
  readonly recent: ReadonlyArray<QuestionRow>;
  readonly answered: ReadonlyArray<QuestionRow>;
  readonly answerable: ReadonlyArray<OpenQuestion>;
  readonly blockingCount: number;
};

type Params = {
  readonly open: ReadonlyArray<OpenQuestion>;
  readonly answered: ReadonlyArray<OpenQuestion>;
  readonly agents: ReadonlyArray<Agent>;
  readonly staged: ReadonlyArray<OpenQuestionId>;
  readonly dismissed: OpenQuestion | null;
};

const newestAnsweredFirst = (first: OpenQuestion, second: OpenQuestion): number =>
  (second.answeredAt ?? second.createdAt).localeCompare(first.answeredAt ?? first.createdAt);

export const buildQuestionsLens = ({
  open,
  answered,
  agents,
  staged,
  dismissed,
}: Params): QuestionsLensModel => {
  const live = open.filter((question) => question.id !== dismissed?.id);
  const partition = partitionDelegatedQuestions({ questions: live, agents });
  const waiting = partition.answerable.filter((question) => !staged.includes(question.id));
  const stagedRows = partition.answerable
    .filter((question) => staged.includes(question.id))
    .map((question): QuestionRow => ({ question, kind: 'staged' }));
  const dismissedRows: ReadonlyArray<QuestionRow> =
    dismissed === null ? [] : [{ question: dismissed, kind: 'dismissed' }];

  return {
    waiting: waiting.map((question) => ({ question, kind: 'waiting' })),
    delegated: partition.waiting.map((question) => ({ question, kind: 'delegated' })),
    recent: [...stagedRows, ...dismissedRows],
    answered: [...answered]
      .sort(newestAnsweredFirst)
      .map((question) => ({ question, kind: 'answered' })),
    answerable: partition.answerable,
    blockingCount: waiting.filter((question) => question.isBlocking).length,
  };
};

type VisibleParams = {
  readonly model: QuestionsLensModel;
  readonly isAnsweredOpen: boolean;
};

export const visibleQuestionRows = ({
  model,
  isAnsweredOpen,
}: VisibleParams): ReadonlyArray<QuestionRow> => [
  ...model.waiting,
  ...model.delegated,
  ...model.recent,
  ...(isAnsweredOpen ? model.answered : []),
];

type NextParams = {
  readonly model: QuestionsLensModel;
  readonly from: OpenQuestionId;
};

export const nextWaitingQuestion = ({ model, from }: NextParams): OpenQuestionId | null => {
  const ids = model.waiting.map((row) => row.question.id);
  const start = ids.indexOf(from);
  const rest = start === -1 ? ids : [...ids.slice(start + 1), ...ids.slice(0, start)];
  return rest.find((id) => id !== from) ?? null;
};
