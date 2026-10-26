import { getWorkspaceValue } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type LoadParams = {
  readonly workspaceId: WorkspaceId;
};

export const loadTerminalWorkspaceFolder = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: LoadParams): Promise<void> => {
    let raw: string | null | undefined;
    try {
      raw = await getWorkspaceValue({
        db: tauriDatabase,
        workspaceId,
        key: 'terminal.workspaceFolder',
      });
    } catch (error) {
      await get().reportError({
        title: 'Could not read the terminal folder',
        error,
        workspaceId,
      });
      return;
    }
    const folder = raw === null || raw === undefined || raw === '' ? null : raw;
    set((s) => ({
      terminalFolderOverrides: { ...s.terminalFolderOverrides, [workspaceId]: folder },
    }));
  };
};
