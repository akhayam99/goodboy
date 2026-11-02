import { useEffect, useState } from 'react';
import type { Project } from '@goodboy/types';
import { Button, formatError, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../../shared/utils/formatBytes';
import { useAppStore } from '../../../../../store';
import { openStorage } from '../../../../storage/openStorage';
import { SavedVersionsMeter } from '../../../../../shared/components/SavedVersionsMeter';

type Props = {
  readonly folder: Project;
};

export const SavedVersionsLine = ({ folder }: Props) => {
  const status = useAppStore((state) => state.folderVersionsStatus[folder.id]?.kind ?? null);
  const failure = useAppStore((state) => {
    const found = state.folderVersionsStatus[folder.id];
    return found?.kind === 'failed' ? found.message : null;
  });
  const size = useAppStore((state) => state.folderHistorySizes[folder.id] ?? null);
  const loadFolderHistorySize = useAppStore((state) => state.loadFolderHistorySize);
  const prepareFolderVersions = useAppStore((state) => state.prepareFolderVersions);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'building' || status === 'failed') {
      return;
    }
    setSizeError(null);
    void loadFolderHistorySize({ folder }).catch((error: unknown) =>
      setSizeError(formatError(error)),
    );
  }, [folder, loadFolderHistorySize, status]);

  const retry = async () => {
    setIsRetrying(true);
    setRetryError(null);
    try {
      await prepareFolderVersions({ folder });
    } catch (cause) {
      setRetryError(formatError(cause));
    } finally {
      setIsRetrying(false);
    }
  };
  const reason = retryError ?? failure;

  const StorageIcon = CONCEPT_ICONS.storage;
  if (status === 'failed') {
    return (
      <div role="alert" className="flex min-w-0 items-center gap-2 text-meta text-danger">
        <StorageIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 break-words">
          Saved versions couldn't start{reason === null ? '' : `: ${reason}`}
        </span>
        <Button
          variant="secondary"
          size="xs"
          isBusy={isRetrying}
          busyLabel="Retrying"
          onClick={() => void retry()}
        >
          Retry
        </Button>
      </div>
    );
  }
  if (status === 'building') {
    return (
      <p className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
        <StorageIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">
          Making the first copy of {folder.name}. The first turn waits for it.
        </span>
      </p>
    );
  }
  if (sizeError !== null) {
    return (
      <p className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
        <StorageIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">Couldn't read the size of saved versions</span>
      </p>
    );
  }
  if (size === null) {
    return null;
  }
  return (
    <div className="flex min-w-0 items-center gap-3 text-meta text-muted-foreground">
      <StorageIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1">
        Saved versions for {folder.name}: {formatBytes({ bytes: size.usedBytes })} of{' '}
        {formatBytes({ bytes: size.capBytes })} allowed, kept until 30 days after each session ends
      </span>
      <SavedVersionsMeter folderName={folder.name} size={size} className="w-28" />
      <Button
        variant="quiet"
        size="xs"
        onClick={() => openStorage({ scope: { kind: 'workspace', id: folder.workspaceId } })}
      >
        Review in Storage
      </Button>
    </div>
  );
};
