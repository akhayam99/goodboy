import type { StorageFolder, StorageFolderStatus } from '../../../../store/slices/storage/types';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { WorktreeActionTarget } from '../../../actions/types';
import type { RemoveIntent } from './FolderRemoveConfirm';
import { RowPrimaryAction } from './RowPrimaryAction';
import { STORAGE_COLUMN } from './storageColumns';

type Props = {
  readonly folder: StorageFolder;
  readonly status: StorageFolderStatus;
  readonly isBusy: boolean;
  readonly target: WorktreeActionTarget;
  readonly onEditor: () => void;
  readonly onRemove: (intent: RemoveIntent) => void;
};

export const WorktreeRowActions = ({
  folder,
  status,
  isBusy,
  target,
  onEditor,
  onRemove,
}: Props) => (
  <span className={STORAGE_COLUMN.actions}>
    <RowPrimaryAction
      folder={folder}
      status={status}
      isBusy={isBusy}
      onRemove={onRemove}
      onEditor={onEditor}
    />
    <ObjectOverflowMenu
      target={target}
      label="More actions"
      anchorKey={`worktree:${folder.path}`}
    />
  </span>
);
