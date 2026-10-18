import { Checkbox, Chip, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../conceptIcons';
import { ConflictNotice } from './ConflictNotice';
import type { PlainFolder } from './folderEntry';
import { FolderNotice } from './FolderNotice';
import type { FolderRowContext } from './folderRowContext';
import { FolderRowFrame } from './FolderRowFrame';
import { tildePath } from './tildePath';

type Props = FolderRowContext & {
  readonly folder: PlainFolder;
};

const FolderIcon = CONCEPT_ICONS.projectFolder;

export const PlainFolderRow = ({
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
    icon={<FolderIcon size={ICON_SIZE.hero} strokeWidth={1.6} aria-hidden />}
    isDimmed={!folder.isIncluded}
    lead={lead}
    trailing={trailing}
    meta={<Chip tone="neutral" shape="badge" bordered={false} label="Plain folder" />}
    notice={
      folder.conflict !== null ? (
        <ConflictNotice
          name={folder.name}
          conflict={folder.conflict}
          destinationName={destinationName}
          isBusy={isBusy}
          onMove={() => draft.decide({ path: folder.path, choice: 'move' })}
          onUndo={() => draft.decide({ path: folder.path, choice: 'ask' })}
          onLeave={() => draft.leave({ path: folder.path })}
        />
      ) : folder.isIncluded ? (
        <FolderNotice
          tone="info"
          title="Not a git repository."
          body="Agents can edit files here, with no branches or pull requests."
          actions={
            <Checkbox
              label="Make it a git repository on Create"
              checked={folder.isGitInit}
              disabled={isBusy}
              onChange={(isGitInit) => draft.setGitInit({ path: folder.path, isGitInit })}
            />
          }
        />
      ) : null
    }
  />
);
