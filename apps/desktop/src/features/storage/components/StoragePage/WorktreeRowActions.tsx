import type { StorageFolder, StorageFolderStatus } from '../../../../store/slices/storage/types';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { WorktreeActionTarget } from '../../../actions/types';
import { RowPrimaryAction } from './RowPrimaryAction';
import { STORAGE_COLUMN } from './storageColumns';

type Props = {
  readonly folder: StorageFolder;
  readonly status: StorageFolderStatus;
  readonly target: WorktreeActionTarget;
  readonly onEditor: () => void;
};

export const WorktreeRowActions = ({ folder, status, target, onEditor }: Props) => (
  <span className={STORAGE_COLUMN.actions}>
    <RowPrimaryAction folder={folder} status={status} onEditor={onEditor} />
    <span data-slot="worktree-row-actions" className="row-actions flex w-7 justify-center">
      <ObjectOverflowMenu
        target={target}
        label="More actions"
        anchorKey={`worktree:${folder.path}`}
      />
    </span>
  </span>
);
