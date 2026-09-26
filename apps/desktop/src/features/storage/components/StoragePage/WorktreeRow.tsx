import { useState } from 'react';
import { Checkbox, Skeleton, Tooltip, cn } from '@goodboy/ui';
import {
  isStorageFolderIdle,
  storageFolderLastChange,
  storageFolderStatus,
} from '../../../../store/slices/storage/classifyStorageFolder';
import type { StorageFolder, StorageFolderStatus } from '../../../../store/slices/storage/types';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { folderStatusLabel, folderWhyLine, formatSince, localCommitsNote } from '../../storageCopy';
import { FolderNode } from './FolderNode';
import { FolderRemoveConfirm, type RemoveIntent } from './FolderRemoveConfirm';
import { STORAGE_COLUMN } from './storageColumns';
import { WorktreeRowActions } from './WorktreeRowActions';
import type { ToggleFolder } from './types';

type Props = {
  readonly folder: StorageFolder;
  readonly now: number;
  readonly suggestAfterDays: number;
  readonly isSelecting: boolean;
  readonly isSelected: boolean;
  readonly isRemoving: boolean;
  readonly isMeasuring: boolean;
  readonly onToggle: ToggleFolder;
};

const STATUS_TONE = {
  safe: 'text-muted-foreground',
  'in-use': 'text-muted-foreground',
  checking: 'text-faint-foreground',
  dirty: 'text-foreground',
  operation: 'text-foreground',
  unavailable: 'text-foreground',
  'not-tracked': 'text-foreground',
  writing: 'text-foreground',
} as const satisfies Record<StorageFolderStatus, string>;

export const WorktreeRow = ({
  folder,
  now,
  suggestAfterDays,
  isSelecting,
  isSelected,
  isRemoving,
  isMeasuring,
  onToggle,
}: Props) => {
  const [intent, setIntent] = useState<RemoveIntent | null>(null);
  const status = storageFolderStatus({ folder });
  const statusLabel = isRemoving ? 'Removing…' : folderStatusLabel({ folder, status });
  const title =
    folder.branch === '' ? (folder.path.split('/').at(-1) ?? folder.path) : folder.branch;
  const note = status === 'safe' ? localCommitsNote({ folder }) : null;
  const isRecent =
    status === 'safe' &&
    folder.origin !== 'in-use' &&
    !isStorageFolderIdle({ folder, now, suggestAfterDays });
  const lastChange = storageFolderLastChange({ folder });

  return (
    <div className="flex flex-col">
      <div
        data-testid="storage-folder-row"
        data-status={status}
        className={cn(
          'group flex h-10 items-center gap-2.5 rounded-md px-2 text-body hover:bg-hover',
          isRemoving && 'opacity-60',
        )}
      >
        {isSelecting ? (
          <span className={STORAGE_COLUMN.check}>
            <Checkbox
              checked={isSelected}
              disabled={status !== 'safe' || isRemoving}
              ariaLabel={`Select ${title}`}
              onChange={(isOn) => onToggle({ path: folder.path, isOn })}
            />
          </span>
        ) : null}
        <span className={STORAGE_COLUMN.node}>
          <FolderNode status={status} label={statusLabel} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Tooltip content={folder.path}>
            <span className="truncate text-code text-foreground">{title}</span>
          </Tooltip>
          <span className="truncate text-secondary text-faint-foreground">
            {folderWhyLine({ folder })}
            {note === null ? null : <span className="text-info"> · {note}</span>}
            {isRecent ? <span> · idle under {suggestAfterDays} days</span> : null}
          </span>
        </div>
        <span className={cn(STORAGE_COLUMN.size, 'text-secondary text-foreground')}>
          {folder.sizeBytes === null ? (
            isMeasuring ? (
              <Skeleton className="ml-auto h-3 w-10" />
            ) : (
              <span className="text-faint-foreground">Measuring…</span>
            )
          ) : (
            formatBytes({ bytes: folder.sizeBytes })
          )}
        </span>
        <span className={cn(STORAGE_COLUMN.age, 'text-secondary text-muted-foreground')}>
          {formatSince({ from: lastChange, now })}
        </span>
        <span className={cn(STORAGE_COLUMN.status, 'text-secondary', STATUS_TONE[status])}>
          {statusLabel}
        </span>
        <WorktreeRowActions
          folder={folder}
          status={status}
          isBusy={isRemoving || isSelecting}
          onRemove={setIntent}
        />
      </div>
      {intent === null ? null : (
        <FolderRemoveConfirm folder={folder} intent={intent} onClose={() => setIntent(null)} />
      )}
    </div>
  );
};
