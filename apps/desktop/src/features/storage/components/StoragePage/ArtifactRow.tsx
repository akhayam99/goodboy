import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Checkbox, InlineConfirm, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import {
  isStorageArtifactKept,
  isStorageArtifactRecentlyDeleted,
  isStorageArtifactRecentlyUsed,
  storageArtifactLastUsed,
} from '../../../../store/slices/storage/classifyStorageArtifact';
import type { StorageArtifact } from '../../../../store/slices/storage/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { ARTIFACT_KIND_LABEL, formatAgo } from '../../storageCopy';
import { ARTIFACT_COLUMN } from './artifactColumns';
import { ArtifactRowActions } from './ArtifactRowActions';
import type { ToggleArtifact } from './types';

type Props = {
  readonly artifact: StorageArtifact;
  readonly now: number;
  readonly suggestAfterDays: number;
  readonly isSelecting: boolean;
  readonly isSelected: boolean;
  readonly isSuggested: boolean;
  readonly onToggle: ToggleArtifact;
};

type NoteParams = {
  readonly artifact: StorageArtifact;
  readonly now: number;
  readonly suggestAfterDays: number;
};

const suggestionNote = ({ artifact, now, suggestAfterDays }: NoteParams): string | null => {
  if (isStorageArtifactKept({ artifact, now })) {
    return null;
  }
  if (isStorageArtifactRecentlyDeleted({ artifact, now, suggestAfterDays })) {
    return `deleted under ${suggestAfterDays} days ago`;
  }
  if (isStorageArtifactRecentlyUsed({ artifact, now, suggestAfterDays })) {
    return 'used recently, not suggested';
  }
  return null;
};

export const ArtifactRow = ({
  artifact,
  now,
  suggestAfterDays,
  isSelecting,
  isSelected,
  isSuggested,
  onToggle,
}: Props) => {
  const isDeleting = useAppStore((state) => state.storageDeletingArtifacts[artifact.id] === true);
  const deleteStorageArtifacts = useAppStore((state) => state.deleteStorageArtifacts);
  const reportError = useAppStore((state) => state.reportError);
  const [isArmed, setIsArmed] = useState(false);
  const Icon = CONCEPT_ICONS[artifact.kind];
  const kindLabel = ARTIFACT_KIND_LABEL[artifact.kind];
  const goal = artifact.sessionGoal.trim();
  const note = suggestionNote({ artifact, now, suggestAfterDays });

  const onConfirm = async () => {
    const outcome = await deleteStorageArtifacts({ ids: [artifact.id] });
    const failure = outcome.failed[0];
    if (failure !== undefined) {
      void reportError({
        title: "Couldn't delete this artifact",
        error: new Error(failure.message),
      });
      return;
    }
    setIsArmed(false);
  };

  return (
    <div className="flex flex-col">
      <div
        data-testid="storage-artifact-row"
        className={cn(
          'group flex h-10 items-center gap-2.5 rounded-md px-2 text-sm hover:bg-hover',
          isDeleting && 'opacity-60',
        )}
      >
        {isSelecting ? (
          <span className={ARTIFACT_COLUMN.check}>
            <Checkbox
              checked={isSelected}
              disabled={isDeleting}
              ariaLabel={`Select ${artifact.title}`}
              onChange={(isOn) => onToggle({ id: artifact.id, isOn })}
            />
          </span>
        ) : null}
        <span className={cn(ARTIFACT_COLUMN.node, 'text-muted-foreground')}>
          <Icon size={ICON_SIZE.row} aria-label={kindLabel} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-foreground">{artifact.title}</span>
          <span className="truncate text-2xs text-faint-foreground">
            {goal === '' ? kindLabel : `${kindLabel} · session "${goal}"`}
            {note === null || isSuggested ? null : <span> · {note}</span>}
          </span>
        </div>
        <span className={cn(ARTIFACT_COLUMN.workspace, 'text-2xs text-muted-foreground')}>
          {artifact.workspaceName}
        </span>
        <span className={cn(ARTIFACT_COLUMN.age, 'text-2xs text-muted-foreground')}>
          {formatAgo({ from: artifact.deletedAt, now })}
        </span>
        <span className={cn(ARTIFACT_COLUMN.age, 'text-2xs text-muted-foreground')}>
          {formatAgo({ from: storageArtifactLastUsed({ artifact }), now })}
        </span>
        <span className={cn(ARTIFACT_COLUMN.size, 'text-2xs text-foreground')}>
          {artifact.sizeBytes === null ? (
            <span className="text-faint-foreground">No copy</span>
          ) : (
            formatBytes({ bytes: artifact.sizeBytes })
          )}
        </span>
        <span className={ARTIFACT_COLUMN.actions}>
          {isDeleting ? (
            <span className="text-2xs text-muted-foreground">Deleting…</span>
          ) : (
            <ArtifactRowActions
              artifact={artifact}
              isKept={isStorageArtifactKept({ artifact, now })}
              isBusy={isSelecting}
              onDelete={() => setIsArmed(true)}
            />
          )}
        </span>
      </div>
      {isArmed ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={`Delete this ${kindLabel.toLowerCase()}?`}
          description="Its copy on disk and its record in Goodboy go away."
          confirmLabel="Delete"
          isBusy={isDeleting}
          onConfirm={onConfirm}
          onCancel={() => setIsArmed(false)}
          className="ml-9"
        />
      ) : null}
    </div>
  );
};
