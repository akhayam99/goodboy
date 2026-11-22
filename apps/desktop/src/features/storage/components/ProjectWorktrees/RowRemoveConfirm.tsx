import { useState } from 'react';
import { Button } from '@goodboy/ui';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useAppStore } from '../../../../store';
import type { StorageFolder } from '../../../../store/slices/storage/types';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import { folderRemoveCopyOf, type RemoveIntent } from '../StoragePage/folderRemoveCopyOf';

type Props = {
  readonly folder: StorageFolder;
  readonly intent: RemoveIntent;
  readonly onClose: () => void;
};

export const RowRemoveConfirm = ({ folder, intent, onClose }: Props) => {
  const removeStorageFolders = useAppStore((state) => state.removeStorageFolders);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const copy = folderRemoveCopyOf({ folder, intent });

  const onConfirm = async () => {
    setIsBusy(true);
    try {
      await removeStorageFolders({ paths: [folder.path], mode: copy.mode });
      onClose();
    } catch (error) {
      setIsBusy(false);
      await reportError({ recovery: CHECK_STATE, title: "Couldn't remove this folder", error });
    }
  };

  return (
    <div role="group" aria-label={copy.title} className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-ui text-foreground">{copy.title}</span>
        <span className="truncate text-meta text-muted-foreground">{copy.description}</span>
      </span>
      <Button size="sm" variant="ghost" disabled={isBusy} onClick={onClose}>
        Cancel
      </Button>
      <Button
        size="sm"
        variant="secondary"
        intent={actionIntentOf({ verb: 'remove' })}
        isBusy={isBusy}
        disabled={isBusy}
        autoFocus
        onClick={() => void onConfirm()}
      >
        {copy.confirmLabel}
      </Button>
    </div>
  );
};
