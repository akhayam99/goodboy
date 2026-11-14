import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { DiffStatText } from '../../../../shared/components/DiffStatText';
import type { ChangesMode } from '../../hooks/useChangesMode';
import type { FilesFact } from '../../filesFact';

type Props = {
  readonly mode: ChangesMode;
  readonly onMode: (mode: ChangesMode) => void;
  readonly count: number;
  readonly fact: FilesFact;
};

export const ModeControl = ({ mode, onMode, count, fact }: Props) => {
  const options: ReadonlyArray<SegmentedTabOption<ChangesMode>> = [
    { value: 'changed', label: `Changed ${count}` },
    { value: 'all', label: 'All files' },
  ];
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 px-2 pb-2">
      <SegmentedTabs
        ariaLabel="Files shown"
        size="xs"
        value={mode}
        options={options}
        onChange={onMode}
      />
      {fact.diff === null ? null : (
        <span className="shrink-0 text-meta tabular-nums">
          <DiffStatText diff={fact.diff} />
        </span>
      )}
    </div>
  );
};
