import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { Band } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import { FolderGitCard } from './FolderGitCard';
import { folderGitCardIds } from './folderGitCardIds';
import type { FolderGitRow } from './folderGitRowOf';
import { useFolderGitProbe } from '../../hooks/useFolderGitProbe';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isInitiallyOpen: boolean;
};

const NO_IDS: ReadonlyArray<ProjectId> = [];

const TRACKABLE: ReadonlyArray<FolderGitRow> = ['no-git', 'no-commits'];

export const FolderGitBand = ({ workspaceId, isInitiallyOpen }: Props) => {
  useFolderGitProbe({ workspaceId, isIncludingLocalRepos: true });
  const visible = useAppStore(useShallow((state) => folderGitCardIds({ state, workspaceId })));
  const existing = useAppStore(
    useShallow((state) =>
      state.projects
        .filter((project) => project.workspaceId === workspaceId)
        .map((project) => project.id),
    ),
  );
  const firstTrackable = useAppStore(
    (state) => folderGitCardIds({ state, workspaceId, rows: TRACKABLE })[0] ?? null,
  );
  const [opened] = useState(() => (isInitiallyOpen ? firstTrackable : null));
  const [shown, setShown] = useState<ReadonlyArray<ProjectId>>(NO_IDS);

  useEffect(() => {
    setShown((current) => {
      const added = visible.filter((projectId) => !current.includes(projectId));
      return added.length === 0 ? current : [...current, ...added];
    });
  }, [visible]);

  const ids = existing.filter(
    (projectId) => visible.includes(projectId) || shown.includes(projectId),
  );
  if (ids.length === 0) {
    return null;
  }
  const BranchIcon = CONCEPT_ICONS.branch;
  return (
    <Band
      inset="content"
      label={NAMES.gitRepository}
      ariaLabel={NAMES.gitRepository}
      hint="For a plain folder that has no git yet."
      icon={<BranchIcon size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <div className="flex flex-col gap-2">
        {ids.map((projectId) => (
          <FolderGitCard
            key={projectId}
            projectId={projectId}
            isInitiallyOpen={projectId === opened}
          />
        ))}
      </div>
    </Band>
  );
};
