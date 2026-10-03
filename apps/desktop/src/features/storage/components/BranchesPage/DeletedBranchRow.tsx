import { Clock, Trash2, Undo2 } from 'lucide-react';
import type { DeletedBranch } from '@goodboy/types';
import { Button, Chip, IconButton, InlineConfirm, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { deletedBranchDays } from '../../branches/deletedBranchDays';

const DELETED_BRANCH_ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_96px_72px_104px_auto] items-center gap-3';

const NEAR_EXPIRY_DAYS = 3;

type Props = {
  readonly entry: DeletedBranch;
  readonly projectName: string;
  readonly now: number;
  readonly isBusy: boolean;
  readonly isConfirming: boolean;
  readonly onRestore: () => void;
  readonly onArmForget: () => void;
  readonly onForget: () => void;
  readonly onCancel: () => void;
};

export const DeletedBranchRow = ({
  entry,
  projectName,
  now,
  isBusy,
  isConfirming,
  onRestore,
  onArmForget,
  onForget,
  onCancel,
}: Props) => {
  const { ago, left } = deletedBranchDays({ deletedAt: entry.deletedAt, now });
  return (
    <li className="flex flex-col gap-1">
      <div className={`${DELETED_BRANCH_ROW_GRID} min-h-10 rounded-md px-2 hover:bg-hover`}>
        <span className="flex min-w-0 flex-col">
          <Tooltip content={entry.branch} anchorClassName="flex min-w-0">
            <span className="truncate font-mono text-code text-foreground">{entry.branch}</span>
          </Tooltip>
          <span className="truncate text-secondary text-faint-foreground">{projectName}</span>
        </span>
        <span className="text-secondary tabular-nums text-muted-foreground">
          {ago === 0 ? 'Today' : ago === 1 ? '1 day ago' : `${ago} days ago`}
        </span>
        <span className="font-mono text-meta text-faint-foreground">{entry.sha.slice(0, 7)}</span>
        <Chip
          tone={left <= NEAR_EXPIRY_DAYS ? 'warning' : 'neutral'}
          size="xs"
          icon={<Clock size={ICON_SIZE.control} aria-hidden />}
          label={left === 1 ? '1 day left' : `${left} days left`}
        />
        <span className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={onRestore}
            aria-label={`Restore ${entry.branch}`}
          >
            <Undo2 size={ICON_SIZE.row} aria-hidden />
            Restore
          </Button>
          <IconButton
            variant="ghost"
            icon={Trash2}
            iconSize={ICON_SIZE.row}
            label={`Delete ${entry.branch} permanently`}
            tooltip="Delete permanently"
            disabled={isBusy || isConfirming}
            onClick={onArmForget}
          />
        </span>
      </div>
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={`Delete ${entry.branch} permanently?`}
          description="It can no longer be restored."
          confirmLabel="Delete permanently"
          isBusy={isBusy}
          onConfirm={onForget}
          onCancel={onCancel}
        />
      ) : null}
    </li>
  );
};
