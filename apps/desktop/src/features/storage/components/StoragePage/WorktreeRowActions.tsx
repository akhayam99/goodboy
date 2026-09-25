import { OverflowMenu } from '@goodboy/ui';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';
import { storageFolderBucket } from '../../../../store/slices/storage/classifyStorageFolder';
import type { StorageFolder, StorageFolderStatus } from '../../../../store/slices/storage/types';
import { openInEditor } from '../../../../shared/lib/editor';
import { revealInFileManager } from '../../storage';
import type { RemoveIntent } from './FolderRemoveConfirm';
import { RowPrimaryAction } from './RowPrimaryAction';
import { STORAGE_COLUMN } from './storageColumns';
import { worktreeRowMenu } from './worktreeRowMenu';

type Props = {
  readonly folder: StorageFolder;
  readonly status: StorageFolderStatus;
  readonly isBusy: boolean;
  readonly onRemove: (intent: RemoveIntent) => void;
};

type AttemptParams = {
  readonly title: string;
  readonly action: () => Promise<void>;
};

export const WorktreeRowActions = ({ folder, status, isBusy, onRemove }: Props) => {
  const keepStorageFolder = useAppStore((state) => state.keepStorageFolder);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();

  const attempt = ({ title, action }: AttemptParams) =>
    void action().catch((error: unknown) => reportError({ title, error }));

  const onEditor = () =>
    attempt({ title: "Couldn't open the editor", action: () => openInEditor(folder.path) });

  const items = worktreeRowMenu({
    folder,
    status,
    bucket: storageFolderBucket({ folder, now: Date.now() }),
    handlers: {
      onReveal: () =>
        attempt({
          title: "Couldn't show this folder",
          action: () => revealInFileManager({ path: folder.path }),
        }),
      onEditor,
      onCopy: () =>
        attempt({
          title: "Couldn't copy the path",
          action: async () => {
            await navigator.clipboard.writeText(folder.path);
            showToast({ kind: 'success', message: 'Path copied' });
          },
        }),
      onKeep: (days) =>
        attempt({
          title: "Couldn't keep this folder",
          action: () => keepStorageFolder({ path: folder.path, days }),
        }),
      onStopKeeping: () =>
        attempt({
          title: "Couldn't update this folder",
          action: () => keepStorageFolder({ path: folder.path, days: null, isStopping: true }),
        }),
      onRemove,
    },
  });

  return (
    <span className={STORAGE_COLUMN.actions}>
      <RowPrimaryAction
        folder={folder}
        status={status}
        isBusy={isBusy}
        onRemove={onRemove}
        onEditor={onEditor}
      />
      <OverflowMenu items={items} label="More actions" align="right" />
    </span>
  );
};
