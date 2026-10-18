import { Chip, ICON_SIZE } from '@goodboy/ui';
import { FOLDER_FACE_COPY } from '../../../features/workspace/folderFaceCopy';
import { CONCEPT_ICONS } from '../conceptIcons';
import { ConflictNotice } from './ConflictNotice';
import type { PlainFolder } from './folderEntry';
import { FolderFaceChoice } from './FolderFaceChoice';
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
    meta={
      <Chip
        tone="neutral"
        shape="badge"
        bordered={false}
        label={
          folder.purpose === null
            ? FOLDER_FACE_COPY.plainChip
            : FOLDER_FACE_COPY[folder.purpose].chip
        }
      />
    }
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
        <FolderFaceChoice folder={folder} draft={draft} isBusy={isBusy} />
      ) : null
    }
  />
);
