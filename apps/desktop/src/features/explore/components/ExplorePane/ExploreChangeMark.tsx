import { cn, Tooltip, tintClasses } from '@goodboy/ui';
import { STATUS_LETTER, STATUS_TONE, STATUS_WORD } from '../../../diff/lib/fileStatus';
import type { ChangedEntry } from '../../../worktree/worktree';

type Props = {
  readonly change: ChangedEntry | null;
  readonly folderChangeCount: number;
};

export const ExploreChangeMark = ({ change, folderChangeCount }: Props) => {
  if (change !== null) {
    return (
      <span
        data-slot="explore-change-slot"
        aria-label={STATUS_WORD[change.status]}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center text-chip',
          tintClasses(STATUS_TONE[change.status]).text,
        )}
      >
        {STATUS_LETTER[change.status]}
      </span>
    );
  }
  if (folderChangeCount > 0) {
    const label = `${folderChangeCount} changed ${folderChangeCount === 1 ? 'file' : 'files'}`;
    return (
      <Tooltip content={label}>
        <span
          data-slot="explore-change-slot"
          role="img"
          aria-label={label}
          className="flex size-4 shrink-0 items-center justify-center"
        >
          <span className="size-1.5 rounded-full bg-muted-foreground ring-1 ring-border" />
        </span>
      </Tooltip>
    );
  }
  return <span aria-hidden data-slot="explore-change-slot" className="size-4 shrink-0" />;
};
