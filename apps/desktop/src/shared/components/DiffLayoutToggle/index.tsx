import { SegmentedTabs } from '@goodboy/ui';
import type { DiffLayoutMode } from '../../utils/diffLayoutMode';

type Props = {
  readonly mode: DiffLayoutMode;
  readonly onChange: (mode: DiffLayoutMode) => void;
};

const OPTIONS = [
  { value: 'unified', label: 'Unified' },
  { value: 'split', label: 'Split' },
] as const;

export const DiffLayoutToggle = ({ mode, onChange }: Props) => (
  <SegmentedTabs<DiffLayoutMode>
    options={OPTIONS}
    value={mode}
    onChange={onChange}
    size="sm"
    ariaLabel="Diff layout"
    className="shrink-0"
  />
);
