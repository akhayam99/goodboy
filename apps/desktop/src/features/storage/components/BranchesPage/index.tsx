import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import type { BranchScope } from '../../branches/branchScope';
import { BranchesSection } from '../BranchesSection';
import { RecentlyDeletedBranches } from './RecentlyDeletedBranches';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const BranchesPage = ({ workspaceId }: Props) => {
  const scope = useMemo<BranchScope>(() => ({ kind: 'workspace', id: workspaceId }), [workspaceId]);

  return (
    <>
      <BranchesSection scope={scope} />
      <RecentlyDeletedBranches scope={scope} />
    </>
  );
};
