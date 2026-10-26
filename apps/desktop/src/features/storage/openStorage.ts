import { useAppStore } from '../../store';
import type { StorageFilter, StorageScope } from '../../store/slices/storage/types';
import { openSettings } from '../settings/openSettings';

type Params = {
  readonly filter?: StorageFilter;
  readonly scope?: StorageScope;
};

export const openStorage = ({ filter = 'review', scope }: Params = {}) => {
  const store = useAppStore.getState();
  store.focusStorage({ filter });
  if (scope !== undefined) {
    store.setStorageScope(scope);
  }
  openSettings({ scope: 'app', section: 'storage' });
};
