import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, InlineConfirm } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { StorageFolder } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly suggested: ReadonlyArray<StorageFolder>;
  readonly suggestAfterDays: number;
  readonly selected: ReadonlySet<string> | null;
  readonly onStart: () => void;
  readonly onCancel: () => void;
  readonly onDone: () => void;
};

type TallyParams = {
  readonly folders: ReadonlyArray<StorageFolder>;
};

const bytesOf = ({ folders }: TallyParams): number =>
  folders.reduce((sum, folder) => sum + (folder.sizeBytes ?? 0), 0);

export const BulkRemoveBar = ({
  suggested,
  suggestAfterDays,
  selected,
  onStart,
  onCancel,
  onDone,
}: Props) => {
  const folders = useAppStore((state) => state.storageFolders);
  const removeStorageFolders = useAppStore((state) => state.removeStorageFolders);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);

  if (selected === null) {
    if (suggested.length === 0) {
      return (
        <p className="px-2 text-secondary text-faint-foreground">
          No clean folder has been idle for over {suggestAfterDays} days.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-3 px-2 py-1.5">
        <Button variant="secondary" size="sm" onClick={onStart}>
          <Trash2 size={ICON_SIZE.row} aria-hidden />
          Remove {suggested.length} safe {suggested.length === 1 ? 'folder' : 'folders'} ·{' '}
          {formatBytes({ bytes: bytesOf({ folders: suggested }) })}
        </Button>
        <span className="text-secondary text-faint-foreground">
          Only clean folders idle for over {suggestAfterDays} days. Folders with changes are
          skipped.
        </span>
      </div>
    );
  }

  const chosen = folders.filter((folder) => selected.has(folder.path));
  const withCommits = chosen.filter((folder) => (folder.facts?.localOnlyCommits ?? 0) > 0).length;
  const commitsClause =
    withCommits === 0 ? '' : `, including ${withCommits} with commits that were never pushed`;

  const onConfirm = async () => {
    setIsBusy(true);
    try {
      await removeStorageFolders({ paths: chosen.map((folder) => folder.path), mode: 'safe' });
      onDone();
    } catch (error) {
      void reportError({ title: "Couldn't remove the folders", error });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <InlineConfirm
      role="danger"
      icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
      title={`Remove ${pluralize(chosen.length, 'folder')} (${formatBytes({ bytes: bytesOf({ folders: chosen }) })})?`}
      description={`Branches stay${commitsClause}. Folders with changes are skipped.`}
      confirmLabel="Remove"
      isConfirmDisabled={chosen.length === 0}
      isBusy={isBusy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
