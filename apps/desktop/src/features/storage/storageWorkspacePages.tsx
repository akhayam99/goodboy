import type { ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { BranchesPage } from './components/BranchesPage';
import { BranchesHeaderActions } from './components/BranchesPage/BranchesHeaderActions';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type StorageWorkspacePage = {
  readonly body: ReactNode;
  readonly actions: ReactNode;
};

export const storageWorkspacePages = ({
  workspaceId,
}: Params): Readonly<Record<'branches', StorageWorkspacePage>> => ({
  branches: {
    body: <BranchesPage workspaceId={workspaceId} />,
    actions: <BranchesHeaderActions workspaceId={workspaceId} />,
  },
});
