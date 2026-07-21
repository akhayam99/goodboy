import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

type SessionsSidebarStorage = {
  readonly read: () => boolean;
  readonly write: (collapsed: boolean) => void;
};

export const sessionsSidebarStorage: SessionsSidebarStorage = {
  read: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.sessionsSidebarCollapsed) === '1';
    } catch {
      return false;
    }
  },
  write: (collapsed) => {
    try {
      localStorage.setItem(STORAGE_KEYS.sessionsSidebarCollapsed, collapsed ? '1' : '0');
    } catch {
      return;
    }
  },
};
