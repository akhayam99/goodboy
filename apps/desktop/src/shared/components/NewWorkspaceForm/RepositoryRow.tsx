import { GitBranch } from 'lucide-react';
import { Chip, ICON_SIZE, ICON_STROKE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../conceptIcons';
import { FOLDER_FACE_COPY } from '../../../features/workspace/folderFaceCopy';
import { ConflictNotice } from './ConflictNotice';
import type { RepositoryFolder } from './folderEntry';
import type { FolderRowContext } from './folderRowContext';
import { InsideRepositoryChoice } from './InsideRepositoryChoice';
import { FolderRowFrame } from './FolderRowFrame';
import { tildePath } from './tildePath';

type Props = FolderRowContext & {
  readonly folder: RepositoryFolder;
};

const RepoIcon = CONCEPT_ICONS.projectRepo;

export const RepositoryRow = ({
  folder,
  draft,
  home,
  destinationName,
  isBusy,
  lead,
  trailing,
}: Props) => {
  const isOnlyFolder = folder.scope === 'folder' && folder.snappedFrom !== null;
  const conflict =
    folder.conflict === null || isOnlyFolder ? null : (
      <ConflictNotice
        name={folder.name}
        conflict={folder.conflict}
        destinationName={destinationName}
        isBusy={isBusy}
        onMove={() => draft.decide({ path: folder.path, choice: 'move' })}
        onUndo={() => draft.decide({ path: folder.path, choice: 'ask' })}
        onLeave={() => draft.leave({ path: folder.path })}
      />
    );
  const inside =
    folder.snappedFrom === null || !folder.isIncluded ? null : (
      <InsideRepositoryChoice
        folder={folder}
        snappedFrom={folder.snappedFrom}
        draft={draft}
        isBusy={isBusy}
      />
    );
  return (
    <FolderRowFrame
      name={folder.name}
      path={tildePath({ path: folder.path, home })}
      icon={<RepoIcon size={ICON_SIZE.hero} strokeWidth={ICON_STROKE.hero} aria-hidden />}
      isDimmed={!folder.isIncluded}
      lead={lead}
      trailing={trailing}
      meta={
        isOnlyFolder ? (
          <Chip
            className="rounded-md"
            kind="state"
            tone="neutral"
            bordered={false}
            label={FOLDER_FACE_COPY.documents.chip}
          />
        ) : (
          <>
            <Chip className="rounded-md" kind="state" tone="neutral" bordered={false} label="Git" />
            {folder.defaultBranch === null ? null : (
              <Chip
                className="rounded-md"
                kind="state"
                tone="neutral"
                bordered={false}
                icon={<GitBranch size={ICON_SIZE.row} aria-hidden />}
                label={folder.defaultBranch}
              />
            )}
          </>
        )
      }
      notice={
        inside === null && conflict === null ? null : (
          <div className="flex flex-col gap-2">
            {inside}
            {conflict}
          </div>
        )
      }
    />
  );
};
