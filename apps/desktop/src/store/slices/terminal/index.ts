import { addTerminalTab } from './addTerminalTab';
import { closeSessionTerminals } from './closeSessionTerminals';
import { closeTerminal } from './closeTerminal';
import { closeTerminalTab } from './closeTerminalTab';
import { openTerminal } from './openTerminal';
import { reattachTerminalTabs } from './reattachTerminalTabs';
import { setActiveTerminalTab } from './setActiveTerminalTab';
import { setTerminalTabStatus } from './setTerminalTabStatus';
import type { GetFn, SetFn } from './types';

export const createTerminalSlice = (set: SetFn, get: GetFn) => {
  return {
    openTerminal: openTerminal(set),
    reattachTerminalTabs: reattachTerminalTabs(set),
    closeTerminal: closeTerminal(set),
    addTerminalTab: addTerminalTab(set, get),
    closeTerminalTab: closeTerminalTab(set, get),
    setActiveTerminalTab: setActiveTerminalTab(set),
    setTerminalTabStatus: setTerminalTabStatus(set),
    closeSessionTerminals: closeSessionTerminals(set, get),
  };
};
