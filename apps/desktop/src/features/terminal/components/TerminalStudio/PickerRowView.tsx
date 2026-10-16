import { Folder, GitBranch } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PickerRow } from '../../terminalPickerClusters';
import { PathLine } from '../PathLine';
import { WorktreeChip } from '../WorktreeChip';

type Props = {
  readonly row: PickerRow;
  readonly isActive: boolean;
  readonly onPick: () => void;
  readonly onOpenProject: () => void;
};

export const PickerRowView = ({ row, isActive, onPick, onOpenProject }: Props) => {
  const Icon = row.kind === 'workspace' ? Folder : GitBranch;
  return (
    <div
      className={cn(
        'group flex min-w-0 items-center gap-1 rounded-md hover:bg-hover focus-within:bg-hover',
        isActive && 'bg-hover',
      )}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onPick}
        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-2 text-left focus-visible:outline-none"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
          <span className="min-w-0 shrink truncate text-label text-foreground">
            {row.projectName}
          </span>
          {row.branch === null ? null : (
            <span className="min-w-0 truncate font-mono text-meta text-faint-foreground">
              {row.branch}
            </span>
          )}
          <span className="flex-1" />
          {row.kind === 'workspace' || row.folder === null ? null : (
            <WorktreeChip folder={row.folder} />
          )}
        </span>
        <PathLine path={row.path} />
      </button>
      {row.kind === 'workspace' ? null : (
        <button
          type="button"
          role="menuitem"
          aria-label={`Open project ${row.projectName}`}
          onClick={onOpenProject}
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-meta text-muted-foreground',
            'hover:bg-selected hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          )}
        >
          Open project
        </button>
      )}
    </div>
  );
};
