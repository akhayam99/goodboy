import { useState } from 'react';
import type { FolderPurpose, Project } from '@goodboy/types';
import { formatError, SegmentedTabs } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { FOLDER_FACE_COPY } from '../../../../workspace/folderFaceCopy';
import { FolderGitCard } from '../../../../workspace/folderGitCard';
import { SavedVersionsLine } from './SavedVersionsLine';

type ChooseParams = {
  readonly next: FolderPurpose;
};

type Props = {
  readonly folder: Project;
  readonly isGitInitiallyOpen: boolean;
};

export const PlainFolderOptions = ({ folder, isGitInitiallyOpen }: Props) => {
  const purpose = useAppStore((state) => state.folderPurpose[folder.id] ?? null);
  const setFolderPurpose = useAppStore((state) => state.setFolderPurpose);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async ({ next }: ChooseParams) => {
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
  return (
    <div
      role="group"
      aria-label={`${folder.name}, what it is for`}
      aria-busy={isSaving}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <span className="text-meta text-muted-foreground">Kind</span>
        <SegmentedTabs
          size="xs"
          ariaLabel={`What ${folder.name} is for`}
          options={tabs}
          value={purpose}
          onChange={(next) => void choose({ next })}
        />
        <p className="text-meta text-muted-foreground">
          {purpose === null ? FOLDER_FACE_COPY.pickBlock : FOLDER_FACE_COPY[purpose].meaning}
        </p>
        {error === null ? null : (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
      </div>
      <FolderGitCard projectId={folder.id} isInitiallyOpen={isGitInitiallyOpen} isEmbedded />
      <SavedVersionsLine folder={folder} />
    </div>
  );
};
