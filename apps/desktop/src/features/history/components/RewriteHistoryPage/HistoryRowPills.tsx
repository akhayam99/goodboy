import { Cloud, GitPullRequest } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type HistoryRowPillState = {
  readonly isHead: boolean;
  readonly remote: 'current' | 'old' | null;
  readonly prNumber: number | null;
};

const PILL =
  'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border px-2 text-chip whitespace-nowrap';
const WARN = tintClasses('warning');

export const HistoryRowPills = ({ isHead, remote, prNumber }: HistoryRowPillState) => {
  if (!isHead && remote === null && prNumber === null) {
    return null;
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      {isHead ? (
        <span className={cn(PILL, 'border-border-soft bg-elevated text-foreground')}>
          You are here
        </span>
      ) : null}
      {remote === null ? null : (
        <span
          className={cn(
            PILL,
            remote === 'old'
              ? cn(WARN.border, WARN.text)
              : 'border-border-soft bg-fill text-muted-foreground',
          )}
        >
          <Cloud size={ICON_SIZE.row} aria-hidden />
          {remote === 'old' ? 'Online copy: old version' : 'Online copy'}
        </span>
      )}
      {prNumber === null ? null : (
        <span className={cn(PILL, 'border-border-soft bg-fill text-muted-foreground')}>
          <GitPullRequest size={ICON_SIZE.row} aria-hidden />
          PR #{prNumber}
        </span>
      )}
    </span>
  );
};
