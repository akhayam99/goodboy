import { Skeleton, cn } from '@goodboy/ui';
import { formatRelativeAge } from '../../../../../../shared/utils/relativeDate';
import type { FileVersionGroup } from './fileVersionGroups';

type Props = {
  groups: ReadonlyArray<FileVersionGroup>;
  selectedPath: string | null;
  loading: boolean;
  onSelectPath: (relativePath: string) => void;
};

export const PathSummaryList = ({ groups, selectedPath, loading, onSelectPath }: Props) => {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <li key={group.relativePath}>
          <button
            type="button"
            onClick={() => onSelectPath(group.relativePath)}
            aria-current={selectedPath === group.relativePath ? 'page' : undefined}
            className={cn(
              'flex w-full flex-col gap-1 rounded-lg border border-border-soft bg-background px-3 py-2 text-left transition-colors',
              selectedPath === group.relativePath
                ? 'border-primary/40 bg-primary/5'
                : 'hover:bg-muted/40',
            )}
          >
            <span className="truncate font-mono text-xs text-foreground">{group.relativePath}</span>
            <span className="text-xs text-muted-foreground">
              {group.count} version{group.count === 1 ? '' : 's'} .{' '}
              {formatRelativeAge({ fromIso: group.lastCapturedAt })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
