import { useState } from 'react';
import { Trash2, TriangleAlert } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import type { WorktreeRemovalMode } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { StorageFolder } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { storageFolderLastChange } from '../../../../store/slices/storage/classifyStorageFolder';
import { formatSince } from '../../storageCopy';

export type RemoveIntent = 'safe' | 'force' | 'untracked';

type Props = {
  readonly folder: StorageFolder;
  readonly intent: RemoveIntent;
  readonly onClose: () => void;
};

type Copy = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly mode: WorktreeRemovalMode;
};

type FolderParams = {
  readonly folder: StorageFolder;
};

type CopyParams = FolderParams & {
  readonly intent: RemoveIntent;
};

const branchPhrase = ({ folder }: FolderParams): string =>
  folder.branch === '' ? 'The branch stays.' : `The branch ${folder.branch} stays.`;

type ChangedParams = {
  readonly count: number;
  readonly sample: string | null;
};

const changedPhrase = ({ count, sample }: ChangedParams): string => {
  if (sample === null) {
    return count === 1 ? '1 file is not committed.' : `${count} files are not committed.`;
  }
  if (count === 1) {
    return `${sample} is not committed.`;
  }
  return `${sample} and ${count - 1} more are not committed.`;
};

const copyOf = ({ folder, intent }: CopyParams): Copy => {
  const size = folder.sizeBytes === null ? 'Its size' : formatBytes({ bytes: folder.sizeBytes });
  if (intent === 'force') {
    const count = Math.max(1, folder.facts?.changedFiles ?? 1);
    const files = count === 1 ? '1 changed file' : `${count} changed files`;
    const which = changedPhrase({ count, sample: folder.facts?.changedSample ?? null });
    return {
      title: `Remove anyway? ${files} will be lost.`,
      description: `${which} ${branchPhrase({ folder })}`,
      confirmLabel: 'Remove folder',
      mode: 'confirmed',
    };
  }
  if (intent === 'untracked') {
    const age = formatSince({ from: storageFolderLastChange({ folder }), now: Date.now() });
    return {
      title: "Remove this folder? Goodboy can't check it for changes.",
      description:
        age === ''
          ? `${size} goes away from disk.`
          : `${size}, last changed ${age} ago, goes away from disk.`,
      confirmLabel: 'Remove folder',
      mode: 'confirmed',
    };
  }
  return {
    title: 'Remove this folder?',
    description: `${size} goes away from disk. ${branchPhrase({ folder })}`,
    confirmLabel: 'Remove',
    mode: 'safe',
  };
};

export const FolderRemoveConfirm = ({ folder, intent, onClose }: Props) => {
  const removeStorageFolders = useAppStore((state) => state.removeStorageFolders);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const copy = copyOf({ folder, intent });

  const onConfirm = async () => {
    setIsBusy(true);
    try {
      await removeStorageFolders({ paths: [folder.path], mode: copy.mode });
      onClose();
    } catch (error) {
      void reportError({ title: "Couldn't remove this folder", error });
      setIsBusy(false);
    }
  };

  return (
    <InlineConfirm
      role={intent === 'safe' ? 'danger' : 'alert'}
      icon={
        intent === 'safe' ? (
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
      className="ml-9"
    />
  );
};
