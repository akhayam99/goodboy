import { RotateCcw, Trash2 } from 'lucide-react';
import { EmptyState, ScrollFade, cn } from '@goodboy/ui';
import type { FileVersion, FileVersionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { formatRelativeAge } from '../../../../../../shared/utils/relativeDate';

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
    <ScrollFade className="min-h-0 flex-1">
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
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide',
                    version.snapshotSource === 'restore'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-info/10 text-info',
                  )}
                >
                  {version.snapshotSource === 'restore' ? 'you' : 'agent'}
                </span>
                <span className="text-2xs text-muted-foreground">{version.changeKind}</span>
                <span className="text-2xs text-muted-foreground">
                  {formatRelativeAge({ fromIso: version.capturedAt })}
                </span>
                <span className="ml-auto text-2xs text-muted-foreground">
                  {new Date(version.capturedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRestoreVersion(version.id)}
                  disabled={isRestoring || deletingVersionId != null}
                  aria-label="restore this version"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw size={12} aria-hidden />
                  {isRestoring ? 'Restoring' : 'Restore'}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteVersion(version.id)}
                  disabled={isDeleting || restoringVersionId != null}
                  aria-label="delete this version"
                  className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </ScrollFade>
  );
};
