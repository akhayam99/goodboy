import { GitBranch } from 'lucide-react';
import { Chip, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../conceptIcons';
import { ConflictNotice } from './ConflictNotice';
import type { RepositoryFolder } from './folderEntry';
import type { FolderRowContext } from './folderRowContext';
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
}: Props) => (
  <FolderRowFrame
    name={folder.name}
    path={tildePath({ path: folder.path, home })}
    icon={<RepoIcon size={ICON_SIZE.hero} strokeWidth={1.6} aria-hidden />}
    isDimmed={!folder.isIncluded}
    lead={lead}
    trailing={trailing}
    meta={
      <>
        <Chip tone="neutral" shape="badge" bordered={false} label="Git" />
        {folder.defaultBranch === null ? null : (
          <Chip
            tone="neutral"
            shape="badge"
            bordered={false}
            icon={<GitBranch size={ICON_SIZE.row} aria-hidden />}
            label={folder.defaultBranch}
          />
        )}
      </>
    }
    notice={
      folder.conflict === null ? null : (
        <ConflictNotice
          name={folder.name}
          conflict={folder.conflict}
          destinationName={destinationName}
          isBusy={isBusy}
          onMove={() => draft.decide({ path: folder.path, choice: 'move' })}
          onUndo={() => draft.decide({ path: folder.path, choice: 'ask' })}
          onLeave={() => draft.leave({ path: folder.path })}
        />
      )
    }
  />
);
