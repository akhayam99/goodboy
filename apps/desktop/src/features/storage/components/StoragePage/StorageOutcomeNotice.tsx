import { Undo2, X } from 'lucide-react';
import { Button, ICON_SIZE, IconButton, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type {
  StorageFolder,
  StorageRemoval,
  StorageRemovalSummary,
} from '../../../../store/slices/storage/types';

import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import { keptReasonPhrase } from '../../storageCopy';

type KeptLineParams = {
  readonly kept: StorageRemoval;
  readonly folders: ReadonlyArray<StorageFolder>;
};

type NameParams = {
  readonly path: string;
  readonly folders: ReadonlyArray<StorageFolder>;
};

const folderNameOf = ({ path, folders }: NameParams): string => {
  const folder = folders.find((candidate) => candidate.path === path);
  return folder === undefined || folder.branch === '' ? path : folder.branch;
};

const keptLine = ({ kept, folders }: KeptLineParams): string => {
  const name = folderNameOf({ path: kept.path, folders });
  if (kept.kind === 'kept') {
    return `${name}: ${keptReasonPhrase({ reasons: kept.reasons, message: kept.message })}.`;
  }
  if (kept.kind === 'failed') {
    return `${name}: ${kept.message}`;
  }
  return name;
};

type SummaryParams = {
  readonly outcome: StorageRemovalSummary;
  readonly folders: ReadonlyArray<StorageFolder>;
};

const undoBody = ({ outcome, folders }: SummaryParams): string | undefined => {
  const failed = outcome.undo?.failed ?? [];
  if (failed.length === 0) {
    return undefined;
  }
  const lines = failed.map(
    (entry) => `${folderNameOf({ path: entry.path, folders })}: ${entry.message}.`,
  );
  return `${failed.length} could not come back. ${lines.join(' ')}`;
};

const undoTitle = ({ outcome }: Pick<SummaryParams, 'outcome'>): string =>
  outcome.undo === null || outcome.undo.restored === 0
    ? 'No folder came back.'
    : `Brought back ${pluralize(outcome.undo.restored, 'folder')}.`;

export const StorageOutcomeNotice = () => {
  const outcome = useAppStore((state) => state.storageOutcome);
  const folders = useAppStore((state) => state.storageFolders);
  const dismiss = useAppStore((state) => state.dismissStorageOutcome);
  const undo = useAppStore((state) => state.undoStorageRemoval);
  if (outcome === null) {
    return null;
  }
  const title =
    outcome.undo !== null
      ? undoTitle({ outcome })
      : outcome.removed === 0
        ? 'No folder was removed.'
        : `Removed ${pluralize(outcome.removed, 'folder')}, ${formatBytes({ bytes: outcome.freedBytes })} back.`;
  const body =
    outcome.undo !== null
      ? undoBody({ outcome, folders })
      : outcome.kept.length === 0
        ? undefined
        : `${outcome.kept.length} kept. ${outcome.kept.map((kept) => keptLine({ kept, folders })).join(' ')}`;
  const isClean =
    outcome.undo === null ? outcome.kept.length === 0 : outcome.undo.failed.length === 0;
  return (
    <Notice
      tone={isClean ? 'success' : 'warning'}
      placement="inline"
      role="status"
      title={title}
      body={body}
      actions={
        <>
          {outcome.restorable.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={outcome.isUndoing}
              onClick={() => void undo()}
            >
              <Undo2 size={ICON_SIZE.row} aria-hidden />
              {outcome.undo === null ? 'Undo' : 'Retry'}
            </Button>
          ) : null}
          <IconButton
            icon={X}
            iconSize={ICON_SIZE.row}
            label="Dismiss"
            variant="ghost"
            onClick={dismiss}
          />
        </>
      }
    />
  );
};
