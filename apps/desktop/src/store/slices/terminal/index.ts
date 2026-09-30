import { addTerminalTab } from './addTerminalTab';
import { closeSessionTerminals } from './closeSessionTerminals';
import { closeTerminalTab } from './closeTerminalTab';
import { openTerminal } from './openTerminal';
import { reattachTerminalTabs } from './reattachTerminalTabs';
import { setActiveTerminalTab } from './setActiveTerminalTab';
import { setTerminalTabStatus } from './setTerminalTabStatus';
import type { SliceDeps } from '../../slice-types';

export const createTerminalSlice = ({ set, get }: SliceDeps) => {
  return {
    openTerminal: openTerminal(set),
    reattachTerminalTabs: reattachTerminalTabs(set),
    addTerminalTab: addTerminalTab(set, get),
    closeTerminalTab: closeTerminalTab(set, get),
    setActiveTerminalTab: setActiveTerminalTab(set),
    setTerminalTabStatus: setTerminalTabStatus(set),
    closeSessionTerminals: closeSessionTerminals(set, get),
  };
};
