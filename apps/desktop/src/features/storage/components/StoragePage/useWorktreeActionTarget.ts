import { useAppStore } from '../../../../store';
import { storageFolderBucket } from '../../../../store/slices/storage/classifyStorageFolder';
import type { StorageFolder, StorageFolderStatus } from '../../../../store/slices/storage/types';
import { openInEditor } from '../../../../shared/lib/editor';
import { revealInFileManager } from '../../../../shared/lib/reveal';
import type { WorktreeActionTarget } from '../../../actions/types';
import type { WorktreeRemoveIntent } from '../../../actions/kinds/worktree';
import type { RemoveIntent } from './FolderRemoveConfirm';

type Params = {
  readonly folder: StorageFolder;
  readonly status: StorageFolderStatus;
  readonly onRemove: (intent: RemoveIntent) => void;
};

type AttemptParams = {
  readonly title: string;
  readonly action: () => Promise<void>;
};

const removeIntentOf = ({
  status,
}: {
  readonly status: StorageFolderStatus;
}): WorktreeRemoveIntent | null => {
  if (status === 'dirty' || status === 'unavailable') {
    return 'force';
  }
  return status === 'not-tracked' ? 'untracked' : null;
};

export const useWorktreeActionTarget = ({ folder, status, onRemove }: Params) => {
  const keepStorageFolder = useAppStore((state) => state.keepStorageFolder);
  const reportError = useAppStore((state) => state.reportError);

  const attempt = ({ title, action }: AttemptParams) =>
    void action().catch((error: unknown) => reportError({ title, error }));

  const onEditor = () =>
    attempt({
      title: "Couldn't open the editor",
      action: () => openInEditor({ path: folder.path }),
    });

  const target: WorktreeActionTarget = {
    kind: 'worktree',
    facts: {
      path: folder.path,
      isInUse: folder.origin === 'in-use',
      isKept: storageFolderBucket({ folder, now: Date.now() }) === 'kept',
      removeIntent: removeIntentOf({ status }),
      onReveal: () =>
        attempt({
          title: "Couldn't show this folder",
          action: () => revealInFileManager({ path: folder.path }),
        }),
      onEditor,
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
  };
  return { target, onEditor };
};
