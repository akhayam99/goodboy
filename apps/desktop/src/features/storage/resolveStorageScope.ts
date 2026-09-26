import type { WorkspaceId } from '@goodboy/types';
import type { StorageScope } from '../../store/slices/storage/types';

type Params = {
  readonly storedScope: StorageScope | null;
  readonly currentWorkspaceId: WorkspaceId | null;
};

export const resolveStorageScope = ({ storedScope, currentWorkspaceId }: Params): StorageScope => {
  if (storedScope != null) {
    return storedScope;
  }
  if (currentWorkspaceId != null) {
    return { kind: 'workspace', id: currentWorkspaceId };
  }
  return { kind: 'all' };
};
