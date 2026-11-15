import type { ReactNode } from 'react';
import type { QuestionFilterChip } from '../questionsFilterModel';
import { QuestionsFilterBar } from './QuestionsFilterBar';

type PickParams = {
  readonly id: string;
};

type Props = {
  readonly chips: ReadonlyArray<QuestionFilterChip>;
  readonly activeChipId: string;
  readonly hasWaiting: boolean;
  readonly onPick: (params: PickParams) => void;
  readonly trailing: ReactNode;
};

export const QuestionsToolbar = ({ chips, activeChipId, hasWaiting, onPick, trailing }: Props) => (
  <div className="flex min-w-0 items-center justify-between gap-3">
    {hasWaiting ? (
      <QuestionsFilterBar chips={chips} activeId={activeChipId} onPick={onPick} />
    ) : (
      <span />
    )}
    {trailing}
  </div>
);
