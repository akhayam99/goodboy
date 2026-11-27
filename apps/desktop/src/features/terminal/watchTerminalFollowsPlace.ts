import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { parseTerminalId } from '../../store/slices/terminal/terminalOwner';
import { openSessionShell } from './openSessionShell';
import { openWorkspaceTerminal } from './openWorkspaceTerminal';

type WatchedStore = {
  readonly getState: () => AppStore;
  readonly subscribe: (listener: (state: AppStore) => void) => () => void;
};

type Params = {
  readonly store: WatchedStore;
};

type FollowParams = {
  readonly store: WatchedStore;
  readonly scope: SessionId | null;
  readonly left: SessionId | null;
};

const followTerminal = ({ store, scope, left }: FollowParams): void => {
  const state = store.getState();
  if (state.dockScope !== scope || state.appStudio?.kind === 'terminal') {
    return;
  }
  const panel = selectGridTool({ state, kind: 'terminal' });
  if (panel === null || panel.kind !== 'terminal') {
    return;
  }
  const owner = parseTerminalId({ id: panel.payload.terminalId })?.owner ?? null;
  if (scope !== null) {
    if (owner?.kind === 'session' && owner.sessionId === scope) {
      return;
    }
    openSessionShell({ sessionId: scope });
    return;
  }
  const workspaceId =
    left === null ? null : (sessionById(state.sessions, left)?.workspaceId ?? null);
  if (owner?.kind === 'workspace' || workspaceId === null) {
    return;
  }
  void openWorkspaceTerminal({ workspaceId, isFresh: false }).catch((error: unknown) =>
    state.reportError({ recovery: CHECK_STATE, title: "Couldn't open the terminal", error }),
  );
};

export const watchTerminalFollowsPlace = ({ store }: Params): (() => void) => {
  let scope = store.getState().dockScope;
  return store.subscribe((state) => {
    const left = scope;
    const next = state.dockScope;
    if (next === left) {
      return;
    }
    scope = next;
    if (left === undefined || next === undefined) {
      return;
    }
    queueMicrotask(() => followTerminal({ store, scope: next, left }));
  });
};
