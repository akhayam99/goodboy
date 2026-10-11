import { addTerminalTab } from './addTerminalTab';
import { closeSessionTerminals } from './closeSessionTerminals';
import { closeTerminalTab } from './closeTerminalTab';
import { openTerminal } from './openTerminal';
import { loadTerminalWorkspaceFolder } from './loadTerminalWorkspaceFolder';
import { reattachTerminalTabs } from './reattachTerminalTabs';
import { renameTerminalTab } from './renameTerminalTab';
import { setActiveTerminalTab } from './setActiveTerminalTab';
import { setTerminalTabStatus } from './setTerminalTabStatus';
import { setTerminalWorkspaceFolder } from './setTerminalWorkspaceFolder';
import type { SliceDeps } from '../../slice-types';

export const createTerminalSlice = ({ set, get }: SliceDeps) => {
  return {
    openTerminal: openTerminal(set),
    reattachTerminalTabs: reattachTerminalTabs(set, get),
    renameTerminalTab: renameTerminalTab(set, get),
    loadTerminalWorkspaceFolder: loadTerminalWorkspaceFolder(set, get),
    setTerminalWorkspaceFolder: setTerminalWorkspaceFolder(set),
    addTerminalTab: addTerminalTab(set, get),
    closeTerminalTab: closeTerminalTab(set, get),
    setActiveTerminalTab: setActiveTerminalTab(set),
    setTerminalTabStatus: setTerminalTabStatus(set),
    closeSessionTerminals: closeSessionTerminals(set, get),
  };
};
