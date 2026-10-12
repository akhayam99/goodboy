import { forgetTerminalCommand } from '../../../features/terminal/commandTracker';
import { terminalOutputBus } from '../../../features/terminal/outputBus';
import type { TerminalTab } from '../../../shared/types/terminal';
import { exitCapture } from './exitCapture';
import { terminalOwnerKey } from './terminalOwner';
import type { GetFn } from './types';

type FindParams = {
  readonly terminalId: string;
  readonly tabs: Readonly<Record<string, ReadonlyArray<TerminalTab>>>;
};

const tabOf = ({ terminalId, tabs }: FindParams): TerminalTab | null => {
  for (const group of Object.values(tabs)) {
    const found = group.find((tab) => tab.id === terminalId);
    if (found !== undefined) {
      return found;
    }
  }
  return null;
};

let stopWatching: (() => void) | null = null;

type WatchParams = {
  readonly get: GetFn;
};

export const watchTerminalExits = ({ get }: WatchParams) => {
  return (): void => {
    stopWatching?.();
    stopWatching = terminalOutputBus.subscribeExits({
      listener: ({ terminalId }) => {
        exitCapture.record({ terminalId });
        const state = get();
        const tab = tabOf({ terminalId, tabs: state.terminalTabs });
        if (tab === null) {
          return;
        }
        forgetTerminalCommand({ terminalId });
        state.closeTerminalTab({ owner: tab.owner, tabId: tab.id });
        const studio = get().appStudio;
        if (studio?.kind !== 'terminal' || studio.terminalId !== tab.id) {
          return;
        }
        const next = get().activeTerminalTab[terminalOwnerKey({ owner: tab.owner })] ?? null;
        get().amendStudio({ studio: { ...studio, terminalId: next } });
      },
    });
  };
};
