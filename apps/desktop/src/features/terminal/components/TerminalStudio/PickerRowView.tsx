import { Folder, GitBranch } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PickerRow } from '../../terminalPickerClusters';

type Props = {
  readonly row: PickerRow;
  readonly isActive: boolean;
  readonly onPick: () => void;
};

export const PickerRowView = ({ row, isActive, onPick }: Props) => {
  const Icon = row.kind === 'workspace' ? Folder : GitBranch;
  return (
    <Tooltip content={row.path} anchorClassName="flex w-full min-w-0">
      <button
        type="button"
        role="menuitem"
        onClick={onPick}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none',
          isActive && 'bg-hover',
        )}
      >
        <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <span className="min-w-0 max-w-[50%] shrink-0 truncate text-ui text-foreground">
          {row.projectName}
        </span>
        {row.branch === null ? null : (
          <span className="min-w-0 flex-1 truncate font-mono text-meta text-faint-foreground">
            {row.branch}
          </span>
        )}
      </button>
    </Tooltip>
  );
};
