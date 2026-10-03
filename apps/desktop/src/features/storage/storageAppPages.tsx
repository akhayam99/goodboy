import type { ReactNode } from 'react';
import { BranchesPage } from './components/BranchesPage';
import { BranchesHeaderActions } from './components/BranchesPage/BranchesHeaderActions';
import { StoragePage } from './components/StoragePage';
import { StorageHeaderActions } from './components/StoragePage/StorageHeaderActions';

type StorageAppPage = {
  readonly body: ReactNode;
  readonly actions: ReactNode;
};

export const STORAGE_APP_PAGES = {
  storage: { body: <StoragePage />, actions: <StorageHeaderActions /> },
  branches: { body: <BranchesPage />, actions: <BranchesHeaderActions /> },
} as const satisfies Readonly<Record<'storage' | 'branches', StorageAppPage>>;
