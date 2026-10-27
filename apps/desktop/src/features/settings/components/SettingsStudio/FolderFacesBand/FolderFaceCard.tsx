import { useState } from 'react';
import type { FolderPurpose, Project } from '@goodboy/types';
import { formatError, ICON_SIZE, SegmentedTabs } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { tildePath } from '../../../../../shared/components/NewWorkspaceForm/tildePath';
import { useAppStore } from '../../../../../store';
import { FOLDER_FACE_COPY } from '../../../../workspace/folderFaceCopy';
import { SavedVersionsLine } from './SavedVersionsLine';

type Props = {
  readonly folder: Project;
  readonly home: string | null;
};

export const FolderFaceCard = ({ folder, home }: Props) => {
  const purpose = useAppStore((state) => state.folderPurpose[folder.id] ?? null);
  const setFolderPurpose = useAppStore((state) => state.setFolderPurpose);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (next: FolderPurpose) => {
    if (isSaving || next === purpose) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await setFolderPurpose({ projectId: folder.id, purpose: next });
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = FOLDER_FACE_COPY.faces.map((face) => ({
    value: face,
    label: FOLDER_FACE_COPY[face].label,
    disabled: isSaving,
  }));
  const FolderIcon = CONCEPT_ICONS.projectFolder;
  return (
    <div
      role="group"
      aria-label={`${folder.name}, what it is for`}
      aria-busy={isSaving}
      className="flex items-start gap-3 rounded-md bg-background py-2 pl-4 pr-3"
    >
      <span className="flex h-9 shrink-0 items-center">
        <FolderIcon size={ICON_SIZE.hero} aria-hidden className="text-muted-foreground" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-h-9 items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-row text-foreground">{folder.name}</span>
            <span className="truncate text-code text-faint-foreground">
              {tildePath({ path: folder.rootPath, home })}
            </span>
          </span>
          <SegmentedTabs
            size="xs"
            ariaLabel={`What ${folder.name} is for`}
            options={tabs}
            value={purpose}
            onChange={(next) => void choose(next)}
          />
        </div>
        <p className="text-meta text-muted-foreground">
          {purpose === null ? FOLDER_FACE_COPY.pickBlock : FOLDER_FACE_COPY[purpose].meaning}
        </p>
        {error === null ? null : (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
        <SavedVersionsLine folder={folder} />
      </div>
    </div>
  );
};
