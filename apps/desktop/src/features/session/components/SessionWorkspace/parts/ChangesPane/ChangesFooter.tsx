import { Lock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Project } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../../../shared/utils/formatBytes';
import { useAppStore } from '../../../../../../store';
import type { ChangeTurn } from '../../../../../file-versions/changeTurnsOf';
import { skippedLinesOf } from './skippedLinesOf';

type Props = {
  readonly folders: ReadonlyArray<Project>;
  readonly turns: ReadonlyArray<ChangeTurn>;
  readonly sizeError: string | null;
};

const NAMED_SKIPS = 4;

export const ChangesFooter = ({ folders, turns, sizeError }: Props) => {
  const sizes = useAppStore(
    useShallow((state) => folders.map((folder) => state.folderHistorySizes[folder.id] ?? null)),
  );
  const skipped = skippedLinesOf({ turns });
  const isSeveral = folders.length > 1;

  return (
    <div className="flex flex-col gap-1 px-2 text-meta text-muted-foreground">
      {skipped.slice(0, NAMED_SKIPS).map((line) => (
        <p key={line.relativePath} className="flex min-w-0 items-center gap-2">
          <Lock size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">
            {line.relativePath} is not saved: {line.reason}
          </span>
        </p>
      ))}
      {skipped.length > NAMED_SKIPS ? (
        <p className="flex min-w-0 items-center gap-2">
          <Lock size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">
            {skipped.length - NAMED_SKIPS} more{' '}
            {skipped.length - NAMED_SKIPS === 1 ? 'path' : 'paths'} not saved
          </span>
        </p>
      ) : null}
      {folders.map((folder, index) => {
        const size = sizes[index] ?? null;
        if (size === null) {
          return null;
        }
        return (
          <p key={folder.id} className="flex min-w-0 items-center gap-2">
            <CONCEPT_ICONS.storage size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span className="min-w-0 truncate">
              {isSeveral ? `${folder.name}: saved` : 'Saved'} versions use{' '}
              {formatBytes({ bytes: size.usedBytes })} of {formatBytes({ bytes: size.capBytes })}
            </span>
          </p>
        );
      })}
      {sizeError === null ? null : (
        <p className="flex min-w-0 items-center gap-2">
          <CONCEPT_ICONS.storage size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">Couldn't read the size of saved versions</span>
        </p>
      )}
    </div>
  );
};
