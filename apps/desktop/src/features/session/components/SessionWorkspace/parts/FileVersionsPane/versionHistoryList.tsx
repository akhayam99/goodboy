import { RotateCcw, Trash2 } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import type { FileVersion, FileVersionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { AuthorshipChip } from '../AuthorshipChip';
import {
  formatAbsoluteDateTime,
  formatRelativeAge,
} from '../../../../../../shared/utils/relativeDate';

type Props = {
  versions: ReadonlyArray<FileVersion>;
  restoringVersionId: FileVersionId | null;
  deletingVersionId: FileVersionId | null;
  onRestoreVersion: (versionId: FileVersionId) => void;
  onDeleteVersion: (versionId: FileVersionId) => void;
};

export const VersionHistoryList = ({
  versions,
  restoringVersionId,
  deletingVersionId,
  onRestoreVersion,
  onDeleteVersion,
}: Props) => {
  if (versions.length === 0) {
    return (
      <EmptyState
        bordered
        tone={CONCEPT_TONE.diff}
        icon={CONCEPT_ICONS.diff}
        title="Pick a file to see its versions"
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {versions.map((version) => {
        const isRestoring = restoringVersionId === version.id;
        const isDeleting = deletingVersionId === version.id;
        return (
          <li
            key={version.id}
            className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-subtle p-3"
          >
            <div className="flex items-center gap-2">
              <AuthorshipChip byUser={version.snapshotSource === 'restore'} />
              <span className="text-2xs text-muted-foreground">{version.changeKind}</span>
              <span className="text-2xs text-muted-foreground">
                {formatRelativeAge({ fromIso: version.capturedAt })}
              </span>
              <span className="ml-auto text-2xs text-muted-foreground">
                {formatAbsoluteDateTime({ iso: version.capturedAt })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRestoreVersion(version.id)}
                disabled={isRestoring || deletingVersionId != null}
                aria-label="Restore this version"
              >
                <RotateCcw size={12} aria-hidden />
                {isRestoring ? 'Restoring' : 'Restore'}
              </Button>
              <button
                type="button"
                onClick={() => onDeleteVersion(version.id)}
                disabled={isDeleting || restoringVersionId != null}
                aria-label="Delete this version"
                className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
