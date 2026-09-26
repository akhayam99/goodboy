import type { WorkspaceId } from '@goodboy/types';
import type { StorageScope } from '../../store/slices/storage/types';

type Params = {
  readonly ownerWorkspace: WorkspaceId | null;
  readonly scope: StorageScope;
};

export const storageOwnerMatchesScope = ({ ownerWorkspace, scope }: Params): boolean => {
  if (scope.kind === 'all') {
    return true;
  }
  if (scope.kind === 'removed') {
    return ownerWorkspace === null;
  }
  return ownerWorkspace === scope.id;
};
