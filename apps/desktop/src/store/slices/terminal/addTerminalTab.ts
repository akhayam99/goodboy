import type { ProjectId, SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../shared/types/terminal';
import type { GetFn, SetFn } from './types';

type ActiveProjectParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

const activeProjectId = ({ get, sessionId }: ActiveProjectParams): ProjectId | undefined => {
  const state = get();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  return state.sessionActiveProject[sessionId] ?? session?.activeProjectId ?? undefined;
};

function nextOrdinal(tabs: readonly TerminalTab[]): number {
  let max = 0;
  for (const tab of tabs) {
    const trailing = Number.parseInt(tab.id.slice(tab.id.lastIndexOf('t') + 1), 10);
    const ordinal = Number.isNaN(trailing) ? 1 : trailing;
    if (ordinal > max) {
      max = ordinal;
    }
  }
  return max + 1;
}

export const addTerminalTab = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId, cwd: string | null): TerminalTabId => {
    const tabs = get().terminalTabs[sessionId] ?? [];
    const n = nextOrdinal(tabs);
    const id = `${sessionId}::t${n}` as TerminalTabId;
    const tab: TerminalTab = {
      id,
      sessionId,
      title: `Terminal ${n}`,
      cwd,
      projectId: activeProjectId({ get, sessionId }),
      status: 'running',
      createdAt: Date.now(),
    };
    set((s) => ({
      terminalTabs: { ...s.terminalTabs, [sessionId]: [...tabs, tab] },
      activeTerminalTab: { ...s.activeTerminalTab, [sessionId]: id },
    }));
    return id;
  };
};
