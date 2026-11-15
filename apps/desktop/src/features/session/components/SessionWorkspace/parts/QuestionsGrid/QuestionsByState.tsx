import type { ReactNode } from 'react';
import { ListGridGroup } from '@goodboy/ui';
import { NAMES } from '../../../../../../shared/utils/names';
import type { QuestionRow } from '../questionsLensModel';

type RowParams = {
  readonly row: QuestionRow;
  readonly rowKey: string;
  readonly isSelected: boolean;
};

type Props = {
  readonly rows: ReadonlyArray<QuestionRow>;
  readonly selectedKey: string | null;
  readonly renderRow: (params: RowParams) => ReactNode;
};

export const QuestionsByState = ({ rows, selectedKey, renderRow }: Props) =>
  rows.length === 0 ? null : (
    <ListGridGroup headingLevel={2} label={NAMES.needsYou} count={rows.length}>
      {rows.map((row) =>
        renderRow({ row, rowKey: row.question.id, isSelected: row.question.id === selectedKey }),
      )}
    </ListGridGroup>
  );
