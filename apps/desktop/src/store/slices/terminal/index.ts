import { addTerminalTab } from './addTerminalTab';
import { closeSessionTerminals } from './closeSessionTerminals';
import { closeTerminalTab } from './closeTerminalTab';
import { openTerminal } from './openTerminal';
import { loadTerminalWorkspaceFolder } from './loadTerminalWorkspaceFolder';
import { loadDetectedShells } from './loadDetectedShells';
import { reattachTerminalTabs } from './reattachTerminalTabs';
import { renameTerminalTab } from './renameTerminalTab';
import { setActiveTerminalTab } from './setActiveTerminalTab';
import { setTerminalPrefill } from './setTerminalPrefill';
import { rememberTerminalScope } from './rememberTerminalScope';
import { setTerminalSelection } from './setTerminalSelection';
import { setTerminalTabStatus } from './setTerminalTabStatus';
import { setTerminalWorkspaceFolder } from './setTerminalWorkspaceFolder';
import type { SliceDeps } from '../../slice-types';

export const createTerminalSlice = ({ set, get }: SliceDeps) => {
  return {
    openTerminal: openTerminal(set),
    reattachTerminalTabs: reattachTerminalTabs(set, get),
    renameTerminalTab: renameTerminalTab(set, get),
    loadTerminalWorkspaceFolder: loadTerminalWorkspaceFolder(set, get),
    loadDetectedShells: loadDetectedShells(set, get),
    setTerminalWorkspaceFolder: setTerminalWorkspaceFolder(set),
    addTerminalTab: addTerminalTab(set, get),
    closeTerminalTab: closeTerminalTab(set, get),
    setActiveTerminalTab: setActiveTerminalTab(set, get),
    setTerminalSelection: setTerminalSelection(set, get),
    setTerminalTabStatus: setTerminalTabStatus(set, get),
    setTerminalPrefill: setTerminalPrefill({ set }),
    rememberTerminalScope: rememberTerminalScope({ set }),
    closeSessionTerminals: closeSessionTerminals(set, get),
  };
};
