import { useAppStore } from '../../../../store';
import { branchScopeOf } from '../../branches/branchScopeOf';
import { resolveStorageScope } from '../../resolveStorageScope';
import { BranchesSection } from '../BranchesSection';
import { AfterMergeRuleLine } from './AfterMergeRuleLine';
import { RecentlyDeletedBranches } from './RecentlyDeletedBranches';

export const BranchesPage = () => {
  const storedScope = useAppStore((state) => state.storageScope);
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const scope = branchScopeOf({ scope: resolveStorageScope({ storedScope, currentWorkspaceId }) });

  return (
    <div className="flex flex-col gap-6">
      {scope.kind === 'workspace' ? <AfterMergeRuleLine workspaceId={scope.id} /> : null}
      <RecentlyDeletedBranches scope={scope} />
      <BranchesSection scope={scope} />
    </div>
  );
};
