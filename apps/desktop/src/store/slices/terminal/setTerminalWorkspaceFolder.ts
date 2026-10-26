import { setWorkspaceValue } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type SetFolderParams = {
  readonly workspaceId: WorkspaceId;
  readonly folder: string | null;
};

export const setTerminalWorkspaceFolder = (set: SetFn) => {
  return async ({ workspaceId, folder }: SetFolderParams): Promise<void> => {
    const next = folder === null || folder.trim() === '' ? null : folder.trim();
    await setWorkspaceValue({
      db: tauriDatabase,
      workspaceId,
      key: 'terminal.workspaceFolder',
      value: next ?? '',
    });
    set((s) => ({
      terminalFolderOverrides: { ...s.terminalFolderOverrides, [workspaceId]: next },
    }));
  };
};
