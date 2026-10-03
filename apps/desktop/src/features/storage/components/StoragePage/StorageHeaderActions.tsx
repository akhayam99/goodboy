import { useAppStore } from '../../../../store';
import { resolveStorageScope } from '../../resolveStorageScope';
import { StorageCheckAgain } from './StorageCheckAgain';
import { StorageScopePicker } from './StorageScopePicker';
import { StorageSuggestAfterPicker } from './StorageSuggestAfterPicker';

export const StorageHeaderActions = () => {
  const storedScope = useAppStore((state) => state.storageScope);
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const setStorageScope = useAppStore((state) => state.setStorageScope);
  const scope = resolveStorageScope({ storedScope, currentWorkspaceId });
  return (
    <>
      <StorageScopePicker scope={scope} onChange={setStorageScope} />
      <StorageSuggestAfterPicker />
      <StorageCheckAgain />
    </>
  );
};
