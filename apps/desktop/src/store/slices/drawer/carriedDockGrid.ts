import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { sessionById } from '../sessions/sessionIndex';
import { gridWithout } from './gridWithout';
import { parseTerminalId, terminalOwnerKey } from '../terminal/terminalOwner';
import type { DrawerGrid, OpenDrawer } from './state';

type StateParams = {
  readonly state: Pick<AppState, 'sessions' | 'terminalTabs'>;
};

type Params = StateParams & {
  readonly grid: DrawerGrid;
  readonly sessionId: SessionId;
};

type PanelParams = {
  readonly panel: OpenDrawer;
  readonly sessionId: SessionId;
};

type KeptParams = StateParams & {
  readonly panel: OpenDrawer;
  readonly sessionId: SessionId;
};

const isTerminalKept = ({ state, panel, sessionId }: KeptParams): boolean => {
  if (panel.kind !== 'terminal') {
    return true;
  }
  const parsed = parseTerminalId({ id: panel.payload.terminalId });
  const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId;
  if (
    parsed === null ||
    parsed.owner.kind !== 'workspace' ||
    parsed.owner.workspaceId !== workspaceId
  ) {
    return false;
  }
  return (state.terminalTabs[terminalOwnerKey({ owner: parsed.owner })] ?? []).some(
    (tab) => tab.id === panel.payload.terminalId,
  );
};

const reboundOf = ({ panel, sessionId }: PanelParams): OpenDrawer => {
  if (panel.sessionId === null) {
    return panel;
  }
  if (panel.kind === 'browser') {
    return { kind: 'browser', sessionId, payload: null };
  }
  if (panel.kind === 'monitoring') {
    return { kind: 'monitoring', sessionId, payload: null };
  }
  if (panel.kind === 'ask') {
    return { kind: 'ask', sessionId, payload: null };
  }
  if (panel.kind === 'scripts') {
    return { kind: 'scripts', sessionId, payload: null };
  }
  return panel;
};

export const carriedDockGrid = ({ state, grid, sessionId }: Params): DrawerGrid => {
  const isDropped = grid.columns
    .flat()
    .some((panel) => !isTerminalKept({ state, panel, sessionId }));
  const kept = isDropped ? gridWithout({ grid, kinds: ['terminal'] }) : grid;
  return {
    ...kept,
    columns: kept.columns.map((column) => column.map((panel) => reboundOf({ panel, sessionId }))),
    focus: { at: 'page' },
  };
};
