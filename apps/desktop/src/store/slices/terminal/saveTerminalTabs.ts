import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_TERMINAL_TABS, snapshotTerminalTabs } from './savedTerminalTabs';
import type { GetFn } from './types';

let writeChain: Promise<void> = Promise.resolve();
let isLoaded = false;

export const markTerminalTabsLoaded = (): void => {
  isLoaded = true;
};

type SaveParams = {
  readonly get: GetFn;
};

export const saveTerminalTabs = ({ get }: SaveParams): void => {
  if (!isLoaded) {
    return;
  }
  const run = async (): Promise<void> => {
    const state = get();
    const snapshot = snapshotTerminalTabs({
      tabs: state.terminalTabs,
      active: state.activeTerminalTab,
      worktreeActive: state.terminalWorktreeActive,
      selection: state.terminalSelection,
    });
    await setSetting(tauriDatabase, SETTING_TERMINAL_TABS, JSON.stringify(snapshot));
  };
  writeChain = writeChain
    .then(run)
    .catch((error: unknown) =>
      get().reportError({ title: 'Could not save the terminal tabs', error }),
    );
};
