import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import { Trash2, TriangleAlert } from '@goodboy/ui/icons';
import { AnchoredConfirm } from '../../../../shared/components/AnchoredConfirm';
import { useAppStore } from '../../../../store';
import type { StorageFolder } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '@goodboy/ui';
import { folderRemoveCopyOf, type RemoveIntent } from './folderRemoveCopyOf';

type Props = {
  readonly folder: StorageFolder;
  readonly intent: RemoveIntent | null;
  readonly onClose: () => void;
};

export const FolderRemoveConfirm = ({ folder, intent, onClose }: Props) => {
  const removeStorageFolders = useAppStore((state) => state.removeStorageFolders);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const copy = folderRemoveCopyOf({ folder, intent: intent ?? 'safe' });

  const onConfirm = async () => {
    setIsBusy(true);
    try {
      await removeStorageFolders({ paths: [folder.path], mode: copy.mode });
      onClose();
    } catch (error) {
      void reportError({ recovery: CHECK_STATE, title: "Couldn't remove this folder", error });
      setIsBusy(false);
    }
  };

  return (
    <AnchoredConfirm
      width="w-96"
      isOpen={intent !== null}
      role={intent === 'safe' || intent === null ? 'danger' : 'alert'}
      icon={
        intent === 'safe' || intent === null ? (
          <Trash2 size={ICON_SIZE.row} aria-hidden />
        ) : (
          <TriangleAlert size={ICON_SIZE.row} aria-hidden />
        )
      }
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      onConfirm={onConfirm}
      onCancel={onClose}
      isBusy={isBusy}
    />
  );
};
