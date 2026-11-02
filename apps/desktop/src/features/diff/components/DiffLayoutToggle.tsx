import { SegmentedTabs } from '@goodboy/ui';
import type { DiffLayoutMode } from '../hooks/useDiffLayoutMode/diffLayoutMode';
import { SPLIT_MIN_INNER_PX } from '../hooks/useDiffLayoutMode/effectiveDiffLayout';

type Props = {
  readonly mode: DiffLayoutMode;
  readonly onChange: (mode: DiffLayoutMode) => void;
  readonly isSplitAvailable?: boolean;
};

const SPLIT_TOOLTIP = `Needs ${SPLIT_MIN_INNER_PX}px`;

export const DiffLayoutToggle = ({ mode, onChange, isSplitAvailable = true }: Props) => (
  <SegmentedTabs<DiffLayoutMode>
    options={[
      { value: 'unified', label: 'Unified' },
      {
        value: 'split',
        label: 'Split',
        disabled: !isSplitAvailable,
        ...(!isSplitAvailable && { tooltip: SPLIT_TOOLTIP }),
      },
    ]}
    value={isSplitAvailable ? mode : 'unified'}
    onChange={onChange}
    size="sm"
    ariaLabel="Diff layout"
    className="shrink-0"
  />
);
