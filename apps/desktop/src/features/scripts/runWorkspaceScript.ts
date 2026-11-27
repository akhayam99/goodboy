import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { workspaceTerminalOwner } from '../../store/slices/terminal/terminalOwner';
import { scriptCommandOf } from '../terminal/scriptCommandOf';
import type { WorkspaceScript } from './workspaceScriptsOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly script: WorkspaceScript;
};

export const runWorkspaceScript = ({ workspaceId, rootPath, script }: Params): void => {
  const state = useAppStore.getState();
  const owner = workspaceTerminalOwner({ workspaceId });
  const tabId = state.addTerminalTab({ owner, cwd: rootPath });
  state.setTerminalPrefill({
    owner,
    tabId,
    prefill: scriptCommandOf({ script: { invocation: script.invocation, relDir: script.relDir } }),
  });
  state.openDrawer({ kind: 'terminal', sessionId: null, payload: { terminalId: tabId } });
};
