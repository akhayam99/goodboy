import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../../types';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { gridWithout } from '../gridWithout';
import {
  parseTerminalId,
  terminalOwnerKey,
  workspaceTerminalOwner,
} from '../../terminal/terminalOwner';
import type { DrawerGrid, OpenDrawer } from '../state';

type Params = {
  readonly state: Pick<AppState, 'terminalTabs' | 'activeTerminalTab'>;
  readonly grid: DrawerGrid;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId | null;
};

type PanelParams = {
  readonly panel: OpenDrawer;
  readonly sessionId: SessionId | null;
};

type HoldParams = Pick<Params, 'state'> & {
  readonly panel: Extract<OpenDrawer, { readonly kind: 'terminal' }>;
};

type TerminalParams = Pick<Params, 'state' | 'sessionId' | 'workspaceId'> & {
  readonly panel: Extract<OpenDrawer, { readonly kind: 'terminal' }>;
};

type TabParams = {
  readonly tab: TerminalTab;
};

const isShownShell = ({ tab }: TabParams): boolean =>
  tab.status !== 'exited' && tab.openError === undefined;

const heldTerminalOf = ({ state, panel }: HoldParams): OpenDrawer | null =>
  Object.values(state.terminalTabs).some((list) =>
    list.some((tab) => tab.id === panel.payload.terminalId),
  )
    ? panel
    : null;

const shownTerminalOf = ({
  state,
  panel,
  sessionId,
  workspaceId,
}: TerminalParams): OpenDrawer | null => {
  const parsed = parseTerminalId({ id: panel.payload.terminalId });
  const isWorkspaceShell =
    parsed !== null &&
    parsed.owner.kind === 'workspace' &&
    parsed.owner.workspaceId === workspaceId;
  const isSessionShell =
    parsed !== null &&
    parsed.owner.kind === 'session' &&
    sessionId !== null &&
    parsed.owner.sessionId === sessionId;
  const own =
    parsed === null ? [] : (state.terminalTabs[terminalOwnerKey({ owner: parsed.owner })] ?? []);
  if (
    (isWorkspaceShell || isSessionShell) &&
    own.some((tab) => tab.id === panel.payload.terminalId)
  ) {
    return panel;
  }
  if (workspaceId === null) {
    return heldTerminalOf({ state, panel });
  }
  const key = terminalOwnerKey({ owner: workspaceTerminalOwner({ workspaceId }) });
  const tabs = state.terminalTabs[key] ?? [];
  const active = tabs.find(
    (tab) => tab.id === state.activeTerminalTab[key] && isShownShell({ tab }),
  );
  const fallback = active ?? tabs.find((tab) => isShownShell({ tab }));
  if (fallback !== undefined) {
    return { kind: 'terminal', sessionId: null, payload: { terminalId: fallback.id } };
  }
  return heldTerminalOf({ state, panel });
};

const reboundOf = ({ panel, sessionId }: PanelParams): OpenDrawer => {
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
    return { kind: 'scripts', sessionId, payload: panel.payload };
  }
  return panel;
};

export const reboundDockGrid = ({ state, grid, sessionId, workspaceId }: Params): DrawerGrid => {
  const terminal = grid.columns
    .flat()
    .find(
      (panel): panel is Extract<OpenDrawer, { readonly kind: 'terminal' }> =>
        panel.kind === 'terminal',
    );
  const shown =
    terminal === undefined
      ? null
      : shownTerminalOf({ state, panel: terminal, sessionId, workspaceId });
  const base =
    terminal !== undefined && shown === null ? gridWithout({ grid, kinds: ['terminal'] }) : grid;
  return {
    ...base,
    columns: base.columns.map((column) =>
      column.map((panel) =>
        panel.kind === 'terminal' && shown !== null ? shown : reboundOf({ panel, sessionId }),
      ),
    ),
  };
};
