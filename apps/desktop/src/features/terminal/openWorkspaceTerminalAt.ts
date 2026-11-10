import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import {
  terminalOwnerKey,
  workspaceTerminalOwner,
} from '../../store/slices/terminal/terminalOwner';
import { liveTabAt } from './liveTabAt';

type Params = {
  readonly state: Pick<
    AppStore,
    'addTerminalTab' | 'openDrawer' | 'setActiveTerminalTab' | 'terminalTabs'
  >;
  readonly workspaceId: WorkspaceId;
  readonly cwd: string | null;
  readonly isFresh: boolean;
};

export const openWorkspaceTerminalAt = ({ state, workspaceId, cwd, isFresh }: Params): void => {
  const owner = workspaceTerminalOwner({ workspaceId });
  const reusable = isFresh
    ? undefined
    : liveTabAt({ tabs: state.terminalTabs[terminalOwnerKey({ owner })] ?? [], cwd });
  const terminalId = reusable?.id ?? state.addTerminalTab({ owner, cwd });
  if (reusable !== undefined) {
    state.setActiveTerminalTab({ owner, tabId: terminalId });
  }
  state.openDrawer({ kind: 'terminal', sessionId: null, payload: { terminalId } });
};
