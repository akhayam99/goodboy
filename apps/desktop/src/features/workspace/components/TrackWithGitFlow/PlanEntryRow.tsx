import { Checkbox, cn } from '@goodboy/ui';
import type { FirstCommitEntry } from '@goodboy/types';
import { FixedMark } from './FixedMark';
import { planEntryCopy } from './planEntryCopy';

type ToggleParams = {
  readonly key: string;
};

type Props = {
  readonly entry: FirstCommitEntry;
  readonly isIncluded: boolean;
  readonly isDisabled: boolean;
  readonly onToggle: (params: ToggleParams) => void;
};

export const PlanEntryRow = ({ entry, isIncluded, isDisabled, onToggle }: Props) => {
  const copy = planEntryCopy({ entry, isIncluded });
  const isGoing = !entry.isLeftOut || isIncluded;
  return (
    <li
      className={cn(
        'flex min-h-7 items-center gap-2 px-2 text-meta',
        isGoing ? 'text-muted-foreground' : 'text-faint-foreground',
      )}
    >
      {entry.canToggle ? (
        <Checkbox
          checked={isGoing}
          disabled={isDisabled}
          ariaLabel={`Commit ${copy.label}`}
          onChange={() => onToggle({ key: entry.key })}
        />
      ) : (
        <FixedMark isGoing={isGoing} />
      )}
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-code',
          isGoing ? 'text-foreground' : 'line-through decoration-disabled-foreground',
        )}
      >
        {copy.label}
      </span>
      <span className="shrink-0 text-meta">{copy.note}</span>
    </li>
  );
};
