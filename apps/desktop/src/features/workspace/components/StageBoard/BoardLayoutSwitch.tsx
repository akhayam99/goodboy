import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { BoardLayout } from '../../../board/queue/QueueBoard/useBoardPage';

type LayoutParams = {
  readonly layout: BoardLayout;
};

type Props = {
  readonly layout: BoardLayout;
  readonly onChange: (params: LayoutParams) => void;
};

const OPTIONS: ReadonlyArray<SegmentedTabOption<BoardLayout>> = [
  { value: 'queue', label: NAMES.boardQueue },
  { value: 'stages', label: NAMES.boardStages },
];

export const BoardLayoutSwitch = ({ layout, onChange }: Props) => (
  <SegmentedTabs
    options={OPTIONS}
    value={layout}
    size="xs"
    ariaLabel={`${NAMES.board} layout`}
    onChange={(value) => onChange({ layout: value })}
  />
);
