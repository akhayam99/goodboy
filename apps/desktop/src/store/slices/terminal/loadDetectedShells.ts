import { invokeTerminalShellsList } from '../../../features/terminal/terminal';
import type { GetFn, SetFn } from './types';

type LoadParams = {
  readonly isRescan: boolean;
};

export const loadDetectedShells = (set: SetFn, get: GetFn) => {
  return async ({ isRescan }: LoadParams): Promise<void> => {
    try {
      const shells = await invokeTerminalShellsList({ isRescan });
      set({ detectedShells: shells });
    } catch (error) {
      await get().reportError({ title: 'Could not list the shells on this computer', error });
    }
  };
};
