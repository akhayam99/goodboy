import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { Band, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { homeFolder } from '../../../../../shared/lib/homeFolder';
import { useAppStore } from '../../../../../store';
import { FolderFaceCard } from './FolderFaceCard';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const FolderFacesBand = ({ workspaceId }: Props) => {
  const folders = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) =>
          project.workspaceId === workspaceId &&
          project.kind === 'folder' &&
          project.disconnectedAt === undefined,
      ),
    ),
  );
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void homeFolder().then((found) => {
      if (isCurrent) {
        setHome(found);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (folders.length === 0) {
    return null;
  }
  const FolderIcon = CONCEPT_ICONS.projectFolder;
  return (
    <Band
      inset="content"
      label="Plain folders"
      ariaLabel="Plain folders"
      hint="What each folder is for. Agents follow it from the next turn."
      icon={<FolderIcon size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <div className="flex flex-col gap-2">
        {folders.map((folder) => (
          <FolderFaceCard key={folder.id} folder={folder} home={home} />
        ))}
      </div>
    </Band>
  );
};
