import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { StorageFilter } from '../../store/slices/storage/types';

type Params = {
  readonly filter?: StorageFilter;
  readonly workspaceId?: WorkspaceId | null;
};

export const openStorage = ({ filter = 'review', workspaceId = null }: Params = {}) => {
  useAppStore.getState().focusStorage({ filter, workspaceId });
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', { detail: { scope: 'app', section: 'storage' } }),
  );
};
