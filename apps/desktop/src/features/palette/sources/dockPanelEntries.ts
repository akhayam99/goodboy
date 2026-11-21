import type { SessionId } from '@goodboy/types';
import { DRAWER_TIERS, type DockMoveTarget, type DockPane } from '@goodboy/ui';
import { LayoutGrid, RotateCcw } from '@goodboy/ui/icons';
import { useAppStore } from '../../../store';
import { dockMovesOf } from '../../../store/slices/drawer/dockMovesOf';
import { drawerSizingOf } from '../../../store/slices/drawer/drawerSizingOf';
import { gridAtRest } from '../../../store/slices/drawer/gridAtRest';
import { selectDetailDrawer } from '../../../store/slices/drawer/selectDetailDrawer';
import type { DrawerGrid, WorkspaceToolKind } from '../../../store/slices/drawer/state';
import { storedDockGridOf } from '../../../store/slices/drawer/storedDockGrid';
import { NAMES } from '../../../shared/utils/names';
import { RAIL_TOOLS } from '../../session/components/SessionTools/sessionTools';
import type { PaletteEntry, PaletteStep } from '../types';

type Params = {
  readonly grid: DrawerGrid;
  readonly sessionId: SessionId | null;
};

type KindParams = {
  readonly kind: string;
};

type LabelParams = {
  readonly name: string;
  readonly target: DockMoveTarget;
};

type StepParams = {
  readonly kind: WorkspaceToolKind;
  readonly sessionId: SessionId | null;
};

const TOOL_KINDS: ReadonlyArray<WorkspaceToolKind> = ['terminal', 'browser', 'monitoring'];

const nameOf = ({ kind }: KindParams): string =>
  RAIL_TOOLS.find((tool) => tool.pane === kind)?.label ?? kind;

const toolOf = ({ kind }: KindParams): WorkspaceToolKind | null =>
  TOOL_KINDS.find((known) => known === kind) ?? null;

const labelOf = ({ name, target }: LabelParams): string => {
  if (target.at === 'page') {
    return `Move ${name} panel beside the page`;
  }
  const other = nameOf({ kind: target.key });
  if (target.at === 'swap') {
    return `Swap ${name} and ${other} panels`;
  }
  if (target.at === 'beside') {
    return `Move ${name} panel ${target.side === 'before' ? 'left' : 'right'} of ${other}`;
  }
  return `Move ${name} panel ${target.at} ${other}`;
};

const detailPaneOf = (): DockPane | null => {
  const detail = selectDetailDrawer({ state: useAppStore.getState() });
  if (detail === null) {
    return null;
  }
  const sizing = drawerSizingOf({ drawer: detail });
  return { id: 'detail', sizing, savedWidth: DRAWER_TIERS[sizing].fallback };
};

type ToolParams = {
  readonly kind: WorkspaceToolKind;
};

const fittingMovesOf = ({ kind }: ToolParams) =>
  dockMovesOf({
    grid: useAppStore.getState().drawerGrid,
    kind,
    windowWidth: window.innerWidth,
    detail: detailPaneOf(),
  }).filter((move) => move.isFitting);

const moveStepOf = ({ kind, sessionId }: StepParams): PaletteStep | null => {
  const name = nameOf({ kind });
  const moves = fittingMovesOf({ kind });
  if (moves.length === 0) {
    return null;
  }
  return {
    title: `Move ${name} panel`,
    placeholder: 'Pick a place',
    entries: moves.map(({ target }) => ({
      key: `dock-move:${kind}:${JSON.stringify(target)}`,
      label: labelOf({ name, target }),
      kind: 'action',
      group: 'action',
      icon: LayoutGrid,
      run: () => void useAppStore.getState().moveDockPanel({ sessionId, kind, target }),
    })),
  };
};

export const dockPanelEntries = ({ grid, sessionId }: Params): ReadonlyArray<PaletteEntry> => {
  const kinds = grid.columns.flat().flatMap((panel) => toolOf({ kind: panel.kind }) ?? []);
  const moves: ReadonlyArray<PaletteEntry> =
    kinds.length < 2
      ? []
      : kinds.map((kind) => ({
          key: `dock-move:${kind}`,
          label: `Move ${nameOf({ kind })} panel…`,
          kind: 'action',
          group: 'action',
          icon: LayoutGrid,
          step: () => moveStepOf({ kind, sessionId }),
          run: () => undefined,
        }));
  const isAtRest = storedDockGridOf({ grid: gridAtRest({ grid }) }) === storedDockGridOf({ grid });
  const reset: ReadonlyArray<PaletteEntry> = isAtRest
    ? []
    : [
        {
          key: 'dock-reset',
          label: NAMES.resetPanelLayout,
          kind: 'action',
          group: 'action',
          icon: RotateCcw,
          run: () => void useAppStore.getState().resetDockGrid({ sessionId }),
        },
      ];
  return [...moves, ...reset];
};
