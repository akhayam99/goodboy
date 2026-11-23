import type { SessionId } from '@goodboy/types';
import { dockFitProbe, type DockMoveTarget } from '@goodboy/ui';
import { LayoutGrid, RotateCcw } from '@goodboy/ui/icons';
import { useAppStore } from '../../../store';
import { dockMovesOf } from '../../../store/slices/drawer/dockMovesOf';
import { gridAtRest } from '../../../store/slices/drawer/gridAtRest';
import type { DrawerGrid, WorkspaceToolKind } from '../../../store/slices/drawer/state';
import { storedDockGridOf } from '../../../store/slices/drawer/dockGridMemory/storedDockGrid';
import { NAMES } from '../../../shared/utils/names';
import type { PaletteEntry, PaletteStep } from '../types';

type Params = {
  readonly grid: DrawerGrid;
  readonly sessionId: SessionId | null;
};

type KindParams = {
  readonly kind: string;
};

type ToolParams = {
  readonly kind: WorkspaceToolKind;
};

type LabelParams = {
  readonly name: string;
  readonly target: DockMoveTarget;
};

type StepParams = ToolParams & {
  readonly sessionId: SessionId | null;
};

const PANEL_NAMES: Readonly<Record<WorkspaceToolKind, string>> = {
  terminal: NAMES.terminal,
  browser: NAMES.browser,
  monitoring: NAMES.monitor,
};

const TOOL_KINDS: ReadonlyArray<WorkspaceToolKind> = ['terminal', 'browser', 'monitoring'];

const toolOf = ({ kind }: KindParams): WorkspaceToolKind | null =>
  TOOL_KINDS.find((known) => known === kind) ?? null;

const panelNameOf = ({ kind }: KindParams): string => {
  const tool = toolOf({ kind });
  return tool === null ? kind : PANEL_NAMES[tool];
};

const moveLabelOf = ({ name, target }: LabelParams): string => {
  if (target.at === 'page') {
    return `Move ${name} panel beside the page`;
  }
  const other = panelNameOf({ kind: target.key });
  if (target.at === 'swap') {
    return `Swap ${name} and ${other} panels`;
  }
  if (target.at === 'beside') {
    return `Move ${name} panel ${target.side === 'before' ? 'left' : 'right'} of ${other}`;
  }
  return `Move ${name} panel ${target.at} ${other}`;
};

const fittingMovesOf = ({ kind }: ToolParams) =>
  dockMovesOf({ grid: useAppStore.getState().drawerGrid, kind, fits: dockFitProbe.fits }).filter(
    (move) => move.isFitting,
  );

const moveStepOf = ({ kind, sessionId }: StepParams): PaletteStep | null => {
  const name = PANEL_NAMES[kind];
  const moves = fittingMovesOf({ kind });
  if (moves.length === 0) {
    return null;
  }
  return {
    title: `Move ${name} panel`,
    placeholder: 'Pick a place',
    entries: moves.map(({ target }) => ({
      key: `dock-move:${kind}:${JSON.stringify(target)}`,
      label: moveLabelOf({ name, target }),
      kind: 'action',
      group: 'action',
      icon: LayoutGrid,
      run: () => {
        const key = JSON.stringify(target);
        if (!fittingMovesOf({ kind }).some((move) => JSON.stringify(move.target) === key)) {
          return;
        }
        void useAppStore.getState().moveDockPanel({ sessionId, kind, target });
      },
    })),
  };
};

export const dockPanelEntries = ({ grid, sessionId }: Params): ReadonlyArray<PaletteEntry> => {
  const kinds = grid.columns
    .flat()
    .flatMap((panel) => toolOf({ kind: panel.kind }) ?? [])
    .filter((kind) => fittingMovesOf({ kind }).length > 0);
  const moves: ReadonlyArray<PaletteEntry> = kinds.map((kind) => ({
    key: `dock-move:${kind}`,
    label: `Move ${PANEL_NAMES[kind]} panel…`,
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
