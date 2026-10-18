import { cn } from '@goodboy/ui';
import type { FolderHistorySize } from '../../features/file-versions/folderHistorySize';

type Props = {
  readonly folderName: string;
  readonly size: FolderHistorySize;
  readonly className?: string;
};

export const SavedVersionsMeter = ({ folderName, size, className }: Props) => (
  <div
    role="meter"
    aria-label={`Saved versions of ${folderName}`}
    aria-valuemin={0}
    aria-valuemax={size.capBytes}
    aria-valuenow={size.usedBytes}
    className={cn('h-1.5 shrink-0 overflow-hidden rounded-full bg-fill', className)}
  >
    <div
      className="h-full rounded-full bg-primary"
      style={{ width: `${Math.round(size.usedShare * 100)}%` }}
    />
  </div>
);
