import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { workspaceTerminalOwner } from '../../../../../../store/slices/terminal/terminalOwner';
import type { TerminalTab, TerminalTabId } from '../../../../../../shared/types/terminal';
import { WORKSPACE_ID } from '../../BoardScene';

export const openTerminalWithElsewhere = (): void => {
  const state = useAppStore.getState();
  const [key, mounts] = Object.entries(state.sessionProjectMounts)[0] ?? [];
  const mount = mounts?.[0];
  if (key === undefined || mount === undefined) {
    return;
  }
  const running = { id: brandId<SessionId>({ value: key }) };
  const shell: TerminalTab = {
    id: brandId<TerminalTabId>({ value: `ws:${WORKSPACE_ID}::t1` }),
    owner: workspaceTerminalOwner({ workspaceId: WORKSPACE_ID }),
    title: 'shell',
    cwd: '~/code/harborline',
    status: 'running',
    createdAt: 0,
  };
  const sessionShell: TerminalTab = {
    id: brandId<TerminalTabId>({ value: `${running.id}::t1` }),
    owner: { kind: 'session', sessionId: running.id },
    title: 'pnpm dev',
    cwd: mount.worktreePath,
    mountId: mount.mountId,
    status: 'running',
    createdAt: 0,
  };
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    terminalTabs: { [`ws:${WORKSPACE_ID}`]: [shell], [running.id]: [sessionShell] },
  });
  useAppStore
    .getState()
    .openDrawer({ kind: 'terminal', sessionId: null, payload: { terminalId: shell.id } });
};
