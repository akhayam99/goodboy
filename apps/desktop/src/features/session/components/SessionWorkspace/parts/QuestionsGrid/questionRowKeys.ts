import type { OpenQuestionId } from '@goodboy/types';
import type { QuestionBranchGroup } from '../questionsLensModel';

type RowKeyParams = {
  readonly groupKey: string;
  readonly questionId: OpenQuestionId;
};

export const questionBranchRowKeyOf = ({ groupKey, questionId }: RowKeyParams): string =>
  `${groupKey}/${questionId}`;

type HeldParams = {
  readonly group: QuestionBranchGroup;
  readonly questionId: OpenQuestionId;
};

const isHeldBy = ({ group, questionId }: HeldParams): boolean =>
  [...group.waiting, ...group.answered].some((item) => item.row.question.id === questionId);

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
  const first = groups.find((group) => isHeldBy({ group, questionId: selectedId }));
  if (pickedRowKey !== null) {
    const picked = groups.find(
      (group) =>
        isHeldBy({ group, questionId: selectedId }) &&
        pickedRowKey === questionBranchRowKeyOf({ groupKey: group.key, questionId: selectedId }),
    );
    if (picked !== undefined) {
      return pickedRowKey;
    }
  }
  return first === undefined
    ? null
    : questionBranchRowKeyOf({ groupKey: first.key, questionId: selectedId });
};

type SummaryParams = {
  readonly waiting: number;
  readonly fact: string | null;
};

export const questionGroupSummaryOf = ({ waiting, fact }: SummaryParams): string =>
  [fact, waiting === 0 ? null : `${waiting} waiting`].filter((part) => part !== null).join(', ');

type CountParams = {
  readonly group: QuestionBranchGroup;
};

export const questionGroupCountOf = ({ group }: CountParams): number =>
  group.waiting.length + group.answered.length;
