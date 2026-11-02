import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { folderGitCardIds } from '../../components/TrackWithGitFlow/folderGitCardIds';
import type { FolderGitRow } from '../../components/TrackWithGitFlow/folderGitRowOf';
import { useFolderGitProbe } from '../useFolderGitProbe';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isOpeningFirst: boolean;
};

type Opening = {
  readonly openId: ProjectId | null;
  readonly noticeIds: ReadonlyArray<ProjectId>;
};

const TRACKABLE: ReadonlyArray<FolderGitRow> = ['no-git', 'no-commits'];

export const useFolderGitOpening = ({ workspaceId, isOpeningFirst }: Params): Opening => {
  useFolderGitProbe({ workspaceId, isIncludingLocalRepos: true });
  const noticeIds = useAppStore(
    useShallow((state) =>
      state.projects
        .filter(
          (project) =>
            project.workspaceId === workspaceId && state.folderGitNotice[project.id] != null,
        )
        .map((project) => project.id),
    ),
  );
  const firstOpenable = useAppStore(
    (state) =>
      folderGitCardIds({ state, workspaceId, rows: TRACKABLE })[0] ??
      folderGitCardIds({ state, workspaceId })[0] ??
      state.projects
        .filter((project) => project.workspaceId === workspaceId && project.kind === 'folder')
        .map((project) => project.id)[0] ??
      null,
  );
  const [openId] = useState(() => (isOpeningFirst ? firstOpenable : null));
  return { openId, noticeIds };
};
