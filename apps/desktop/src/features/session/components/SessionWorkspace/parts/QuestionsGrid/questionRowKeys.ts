import type { OpenQuestionId } from '@goodboy/types';
import type { QuestionBranchGroup } from '../questionsLensModel';

type RowKeyParams = {
  readonly groupKey: string;
  readonly questionId: OpenQuestionId;
};

export const questionBranchRowKeyOf = ({ groupKey, questionId }: RowKeyParams): string =>
  `${groupKey}/${questionId}`;

type SelectedParams = {
  readonly groups: ReadonlyArray<QuestionBranchGroup>;
  readonly selectedId: OpenQuestionId | null;
  readonly pickedRowKey: string | null;
};

export const selectedQuestionRowKeyOf = ({
  groups,
  selectedId,
  pickedRowKey,
}: SelectedParams): string | null => {
  if (selectedId === null) {
    return null;
  }
  if (pickedRowKey !== null && pickedRowKey.endsWith(`/${selectedId}`)) {
    return pickedRowKey;
  }
  const first = groups.find((group) =>
    [...group.waiting, ...group.answered].some((item) => item.row.question.id === selectedId),
  );
  return first === undefined
    ? null
    : questionBranchRowKeyOf({ groupKey: first.key, questionId: selectedId });
};

type SummaryParams = {
  readonly waiting: number;
  readonly answered: number;
  readonly fact: string | null;
};

export const questionGroupSummaryOf = ({ waiting, answered, fact }: SummaryParams): string =>
  [
    fact,
    waiting === 0 ? null : `${waiting} waiting`,
    answered === 0 ? null : `${answered} answered`,
  ]
    .filter((part) => part !== null)
    .join(', ');
