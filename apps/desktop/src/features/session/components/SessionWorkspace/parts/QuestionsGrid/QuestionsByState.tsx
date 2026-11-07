import type { ReactNode } from 'react';
import { ListGridGroup } from '@goodboy/ui';
import { NAMES } from '../../../../../../shared/utils/names';
import type { QuestionGroups, QuestionRow } from '../questionsLensModel';

type RowParams = {
  readonly row: QuestionRow;
  readonly rowKey: string;
  readonly isSelected: boolean;
};

type Props = {
  readonly groups: QuestionGroups;
  readonly isAnsweredShown: boolean;
  readonly selectedKey: string | null;
  readonly onToggleAnswered: () => void;
  readonly renderRow: (params: RowParams) => ReactNode;
};

export const QuestionsByState = ({
  groups,
  isAnsweredShown,
  selectedKey,
  onToggleAnswered,
  renderRow,
}: Props) => (
  <>
    {groups.waiting.length > 0 ? (
      <ListGridGroup headingLevel={2} label={NAMES.needsYou} count={groups.waiting.length}>
        {groups.waiting.map((row) =>
          renderRow({ row, rowKey: row.question.id, isSelected: row.question.id === selectedKey }),
        )}
      </ListGridGroup>
    ) : null}
    {groups.answered.length > 0 ? (
      <ListGridGroup
        headingLevel={2}
        label="Answered"
        count={groups.answered.length}
        fold={{ label: isAnsweredShown ? 'Hide' : 'Show', onToggle: onToggleAnswered }}
      >
        {isAnsweredShown
          ? groups.answered.map((row) =>
              renderRow({
                row,
                rowKey: row.question.id,
                isSelected: row.question.id === selectedKey,
              }),
            )
          : null}
      </ListGridGroup>
    ) : null}
  </>
);
