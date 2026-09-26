import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, InlineConfirm } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { StorageArtifact } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly suggested: ReadonlyArray<StorageArtifact>;
  readonly suggestAfterDays: number;
  readonly selected: ReadonlySet<string> | null;
  readonly onStart: () => void;
  readonly onDone: () => void;
};

type TallyParams = {
  readonly artifacts: ReadonlyArray<StorageArtifact>;
};

const bytesOf = ({ artifacts }: TallyParams): number =>
  artifacts.reduce((sum, artifact) => sum + (artifact.sizeBytes ?? 0), 0);

export const ArtifactBulkDeleteBar = ({
  suggested,
  suggestAfterDays,
  selected,
  onStart,
  onDone,
}: Props) => {
  const artifacts = useAppStore((state) => state.storageArtifacts);
  const deleteStorageArtifacts = useAppStore((state) => state.deleteStorageArtifacts);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const rule = `Session deleted over ${suggestAfterDays} days ago and not used for ${2 * suggestAfterDays}.`;

  if (selected === null) {
    if (suggested.length === 0) {
      return (
        <p className="px-2 text-secondary text-faint-foreground">
          Nothing unused to delete. {rule}
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-3 px-2 py-1.5">
        <Button variant="secondary" size="sm" onClick={onStart}>
          <Trash2 size={ICON_SIZE.row} aria-hidden />
          Delete {suggested.length} unused ·{' '}
          {formatBytes({ bytes: bytesOf({ artifacts: suggested }) })}
        </Button>
        <span className="text-secondary text-faint-foreground">
          {rule} Deleting removes the copy on disk and the record in Goodboy.
        </span>
      </div>
    );
  }

  const chosen = artifacts.filter((artifact) => selected.has(artifact.id));

  const onConfirm = async () => {
    setIsBusy(true);
    try {
      const outcome = await deleteStorageArtifacts({ ids: chosen.map((artifact) => artifact.id) });
      const failure = outcome.failed[0];
      if (failure !== undefined) {
        void reportError({
          title: `Couldn't delete ${pluralize(outcome.failed.length, 'artifact')}`,
          error: new Error(failure.message),
        });
      }
      onDone();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <InlineConfirm
      role="danger"
      icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
      title={`Delete ${pluralize(chosen.length, 'artifact')} (${formatBytes({ bytes: bytesOf({ artifacts: chosen }) })})?`}
      description="Their copies on disk and their records in Goodboy go away."
      confirmLabel="Delete"
      isConfirmDisabled={chosen.length === 0}
      isBusy={isBusy}
      onConfirm={onConfirm}
      onCancel={onDone}
    />
  );
};
