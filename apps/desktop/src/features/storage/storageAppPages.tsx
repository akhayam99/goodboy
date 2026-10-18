import type { ReactNode } from 'react';
import { StoragePage } from './components/StoragePage';
import { StorageHeaderActions } from './components/StoragePage/StorageHeaderActions';

type StorageAppPage = {
  readonly body: ReactNode;
  readonly actions: ReactNode;
};

export const STORAGE_APP_PAGES = {
  storage: { body: <StoragePage />, actions: <StorageHeaderActions /> },
} as const satisfies Readonly<Record<'storage', StorageAppPage>>;
