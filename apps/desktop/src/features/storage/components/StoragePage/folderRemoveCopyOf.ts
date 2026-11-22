import type { WorktreeRemovalMode } from '@goodboy/types';
import type { StorageFolder } from '../../../../store/slices/storage/types';
import { storageFolderLastChange } from '../../../../store/slices/storage/classifyStorageFolder';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { formatAge } from '../../../../shared/utils/time/formatAge';

export type RemoveIntent = 'safe' | 'force' | 'untracked';

export type FolderRemoveCopy = {
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
    return count === 1 ? "1 file isn't committed." : `${count} files aren't committed.`;
  }
  if (count === 1) {
    return `${sample} isn't committed.`;
  }
  return `${sample} and ${count - 1} more aren't committed.`;
};

export const folderRemoveCopyOf = ({ folder, intent }: CopyParams): FolderRemoveCopy => {
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
    const age = formatAge({ from: storageFolderLastChange({ folder }), now: Date.now() });
    return {
      title: "Remove this folder? Goodboy can't check it for changes.",
      description:
        age === ''
          ? `${size} goes away from disk.`
          : `${size}, last changed ${age}, goes away from disk.`,
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
