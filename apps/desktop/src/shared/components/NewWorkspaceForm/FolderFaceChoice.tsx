import type { FolderPurpose } from '@goodboy/types';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { Checkbox, ChoiceCards, ICON_SIZE, tintClasses } from '@goodboy/ui';
import { FOLDER_FACE_COPY } from '../../../features/workspace/folderFaceCopy';
import { folderSignalsLine } from '../../../features/workspace/folderSignalsLine';
import { largeFolderOf } from '../../../features/workspace/largeFolderOf';
import { formatInteger } from '../../utils/formatInteger';
import { CONCEPT_ICONS } from '../conceptIcons';
import { FaceCheckLine } from './FaceCheckLine';
import type { PlainFolder } from './folderEntry';
import type { WorkspaceDraft } from './useWorkspaceDraft';

type Props = {
  readonly folder: PlainFolder;
  readonly draft: WorkspaceDraft;
  readonly isBusy: boolean;
};

const SignalsIcon = CONCEPT_ICONS.explore;

const FACE_OPTIONS = FOLDER_FACE_COPY.faces.map((face) => ({
  value: face,
  label: FOLDER_FACE_COPY[face].label,
  hint: FOLDER_FACE_COPY[face].hint,
}));

export const FolderFaceChoice = ({ folder, draft, isBusy }: Props) => {
  const large = folder.signals === null ? null : largeFolderOf({ signals: folder.signals });
  const choose = (purpose: FolderPurpose) => {
    if (!isBusy) {
      draft.setPurpose({ path: folder.path, purpose });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 text-meta text-muted-foreground motion-safe:animate-fade-in">
      {folder.signals !== null ? (
        <p className="flex items-center gap-2">
          <SignalsIcon size={ICON_SIZE.row} aria-hidden className={tintClasses('primary').icon} />
          <span className="min-w-0">
            {folderSignalsLine({ signals: folder.signals, preselected: folder.preselected })}
          </span>
        </p>
      ) : folder.isSignalsUnreadable ? (
        <p role="status" className="flex items-center gap-2">
          <CircleAlert size={ICON_SIZE.row} aria-hidden className={tintClasses('warning').icon} />
          <span className="min-w-0">Goodboy couldn't look inside {folder.name}.</span>
        </p>
      ) : null}
      <ChoiceCards
        ariaLabel={`What ${folder.name} is for`}
        options={FACE_OPTIONS}
        value={folder.purpose}
        onChange={choose}
        isHintWrapped
        className="sm:grid-cols-2"
      />
      {folder.purpose === 'code' ? (
        <div className="flex flex-col gap-1">
          <Checkbox
            label="Track it with git when the workspace is created"
            checked={folder.isGitInit}
            disabled={isBusy}
            onChange={(isGitInit) => draft.setGitInit({ path: folder.path, isGitInit })}
          />
          <p className="pl-6 text-meta text-faint-foreground">
            {folder.isGitInit && folder.firstCommitFiles !== null
              ? `${formatInteger(folder.firstCommitFiles)} ${folder.firstCommitFiles === 1 ? 'file goes' : 'files go'} in the first commit. Dependencies, build output and secrets stay out.`
              : 'Runs git init and a first commit of these files. You can also do it later, from the session or Folders.'}
          </p>
        </div>
      ) : null}
      {folder.purpose === 'documents' ? (
        <ul className="flex flex-col gap-1">
          <FaceCheckLine>{FOLDER_FACE_COPY.documentsReadOnly}</FaceCheckLine>
          {large === null ? <FaceCheckLine>{FOLDER_FACE_COPY.documentsSaved}</FaceCheckLine> : null}
        </ul>
      ) : null}
      {large === null ? null : (
        <p role="status" className="flex items-start gap-2">
          <span className="flex h-5 shrink-0 items-center">
            <TriangleAlert
              size={ICON_SIZE.row}
              aria-hidden
              className={tintClasses('warning').icon}
            />
          </span>
          <span className="min-w-0">
            <span className="text-foreground">
              {folder.name} holds {large.size}
              {large.media === null ? '' : `, mostly ${large.media}`}.
            </span>{' '}
            Goodboy keeps versions of files under 15 MB. Larger files are not saved, so a restore
            cannot bring them back.
          </span>
        </p>
      )}
    </div>
  );
};
