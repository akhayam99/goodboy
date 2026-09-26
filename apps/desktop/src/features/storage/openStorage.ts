import { useAppStore } from '../../store';
import type { StorageFilter, StorageScope } from '../../store/slices/storage/types';

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
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', { detail: { scope: 'app', section: 'storage' } }),
  );
};
