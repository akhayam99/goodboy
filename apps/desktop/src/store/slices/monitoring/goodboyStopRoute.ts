import type { LedgerRow } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TerminalOwner, TerminalTabId } from '../../../shared/types/terminal';
import type { AppState } from '../../types';

export type RouteState = Pick<
  AppState,
  'scriptRuns' | 'terminalTabs' | 'sessionPhaseRuns' | 'agentTurnState' | 'sessionMounts'
>;

export type GoodboyStopRoute =
  | { readonly kind: 'script'; readonly sessionId: SessionId; readonly scriptKey: string }
  | { readonly kind: 'terminal'; readonly owner: TerminalOwner; readonly tabId: TerminalTabId }
  | { readonly kind: 'turn'; readonly sessionId: SessionId; readonly agentId: AgentId }
  | { readonly kind: 'process'; readonly pid: number };

type Params = {
  readonly entry: LedgerRow;
  readonly state: RouteState;
};

const isSessionId = (value: string | null): value is SessionId => value !== null;

const scriptRoute = ({ entry, state }: Params): GoodboyStopRoute | null => {
  const sessionId = entry.sessionId;
  if (!isSessionId(sessionId)) {
    return null;
  }
  const mountIds = (state.sessionMounts[sessionId] ?? [])
    .filter((mount) => entry.mountPath === null || mount.worktreePath === entry.mountPath)
    .map((mount) => mount.id);
  const pending = Object.entries(state.scriptRuns[sessionId] ?? {}).filter(
    ([, record]) =>
      record.status === 'pending' &&
      (entry.mountPath === null ||
        record.mountId === undefined ||
        mountIds.includes(record.mountId)),
  );
  const first = pending[0];
  return first === undefined ? null : { kind: 'script', sessionId, scriptKey: first[0] };
};

const terminalRoute = ({ entry, state }: Params): GoodboyStopRoute | null => {
  const tabs = entry.sessionId === null ? [] : (state.terminalTabs[entry.sessionId] ?? []);
  const tab = tabs.find(
    (candidate) => candidate.status === 'running' && candidate.cwd === entry.cwd,
  );
  return tab === undefined ? null : { kind: 'terminal', owner: tab.owner, tabId: tab.id };
};

const turnRoute = ({ entry, state }: Params): GoodboyStopRoute | null => {
  const sessionId = entry.sessionId;
  if (!isSessionId(sessionId)) {
    return null;
  }
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => state.agentTurnState[candidate.id]?.kind === 'running',
  );
  return agent === undefined ? null : { kind: 'turn', sessionId, agentId: agent.id };
};

const routeOf = ({ entry, state }: Params): GoodboyStopRoute | null => {
  switch (entry.kind) {
    case 'script':
      return scriptRoute({ entry, state });
    case 'terminal':
      return terminalRoute({ entry, state });
    case 'turn':
      return turnRoute({ entry, state });
    case 'chat':
    case 'planner':
    case 'summary':
    case 'probe':
      return null;
  }
};

export const goodboyStopRoute = ({ entry, state }: Params): GoodboyStopRoute =>
  routeOf({ entry, state }) ?? { kind: 'process', pid: entry.pid };
