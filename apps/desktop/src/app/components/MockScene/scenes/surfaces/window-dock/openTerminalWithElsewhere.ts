import { useAppStore } from '../../../../../../store';
import { workspaceTerminalOwner } from '../../../../../../store/slices/terminal/terminalOwner';
import type { TerminalTab, TerminalTabId } from '../../../../../../shared/types/terminal';
import { WORKSPACE_ID } from '../../BoardScene';

export const openTerminalWithElsewhere = (): void => {
  const state = useAppStore.getState();
  const running = state.sessions.find(
    (session) => (state.sessionProjectMounts[session.id] ?? []).length > 0,
  );
  if (running === undefined) {
    return;
  }
  const mount = state.sessionProjectMounts[running.id]?.[0];
  const shell: TerminalTab = {
    id: `ws:${WORKSPACE_ID}::t1` as TerminalTabId,
    owner: workspaceTerminalOwner({ workspaceId: WORKSPACE_ID }),
    title: 'shell',
    cwd: '~/code/harborline',
    status: 'running',
    createdAt: 0,
  };
  const sessionShell: TerminalTab = {
    id: `${running.id}::t1` as TerminalTabId,
    owner: { kind: 'session', sessionId: running.id },
    title: 'pnpm dev',
    cwd: mount?.worktreePath ?? null,
    ...(mount === undefined ? {} : { mountId: mount.mountId }),
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
