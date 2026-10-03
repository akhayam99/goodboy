import { Clock, Trash2, Undo2 } from 'lucide-react';
import type { DeletedBranch } from '@goodboy/types';
import { Button, Chip, IconButton, InlineConfirm, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BRANCH_TABLE_GRID } from '../../branches/branchTableGrid';
import { deletedBranchDays } from '../../branches/deletedBranchDays';

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
      <div className={`${BRANCH_TABLE_GRID} rounded-md px-2 hover:bg-hover`}>
        <span data-cell="select" />
        <span data-cell="branch" className="flex min-w-0">
          <Tooltip content={entry.branch} anchorClassName="flex min-w-0">
            <span className="truncate font-mono text-code text-foreground">{entry.branch}</span>
          </Tooltip>
        </span>
        <span data-cell="session" className="truncate text-label text-muted-foreground">
          {projectName}
        </span>
        <span data-cell="state" className="truncate text-label tabular-nums text-muted-foreground">
          {ago === 0 ? 'Today' : ago === 1 ? '1 day ago' : `${ago} days ago`}
        </span>
        <span data-cell="origin" className="truncate font-mono text-meta text-faint-foreground">
          {entry.sha.slice(0, 7)}
        </span>
        <span data-cell="status" className="flex min-w-0">
          <Chip
            tone={left <= NEAR_EXPIRY_DAYS ? 'warning' : 'neutral'}
            size="xs"
            icon={<Clock size={ICON_SIZE.control} aria-hidden />}
            label={left === 1 ? '1 day left' : `${left} days left`}
          />
        </span>
        <span data-cell="age" />
        <span data-cell="action" className="flex items-center justify-end gap-1">
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
