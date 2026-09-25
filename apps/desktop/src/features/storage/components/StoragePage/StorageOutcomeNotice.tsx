import { X } from 'lucide-react';
import { IconButton, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { StorageFolder, StorageRemoval } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import { keptReasonPhrase } from '../../storageCopy';

type KeptLineParams = {
  readonly kept: StorageRemoval;
  readonly folders: ReadonlyArray<StorageFolder>;
};

const keptLine = ({ kept, folders }: KeptLineParams): string => {
  const folder = folders.find((candidate) => candidate.path === kept.path);
  const name = folder === undefined || folder.branch === '' ? kept.path : folder.branch;
  if (kept.kind === 'kept') {
    return `${name}: ${keptReasonPhrase({ reasons: kept.reasons, message: kept.message })}.`;
  }
  if (kept.kind === 'failed') {
    return `${name}: ${kept.message}`;
  }
  return name;
};

export const StorageOutcomeNotice = () => {
  const outcome = useAppStore((state) => state.storageOutcome);
  const folders = useAppStore((state) => state.storageFolders);
  const dismiss = useAppStore((state) => state.dismissStorageOutcome);
  if (outcome === null) {
    return null;
  }
  const title =
    outcome.removed === 0
      ? 'No folder was removed.'
      : `Removed ${pluralize(outcome.removed, 'folder')}, ${formatBytes({ bytes: outcome.freedBytes })} back.`;
  const body =
    outcome.kept.length === 0
      ? undefined
      : `${outcome.kept.length} kept. ${outcome.kept.map((kept) => keptLine({ kept, folders })).join(' ')}`;
  return (
    <Notice
      tone={outcome.kept.length === 0 ? 'success' : 'warning'}
      placement="inline"
      role="status"
      title={title}
      body={body}
      actions={
        <IconButton
          icon={X}
          iconSize={ICON_SIZE.row}
          label="Dismiss"
          variant="ghost"
          onClick={dismiss}
        />
      }
    />
  );
};
