import type { DockGridColumnBox } from './dockGridColumnBox';
import type { PanelPairLayout } from './drawerGeometry';
import { dockGridSpanOf } from './dockGridSpanOf';

type SolvedBox = {
  readonly width: number;
  readonly height: number;
};

type SolvedColumn = {
  readonly box: SolvedBox;
  readonly dragMax: number;
  readonly panes: ReadonlyArray<{ readonly id: string; readonly box: SolvedBox }>;
};

export type SolvedDockFrame = {
  readonly mode: 'push' | 'over';
  readonly isStacked: boolean;
  readonly isDetailOver: boolean;
  readonly detail: SolvedColumn | null;
  readonly columns: ReadonlyArray<SolvedColumn>;
};

export type DockGridFrame = {
  readonly pair: PanelPairLayout;
  readonly columns: ReadonlyArray<DockGridColumnBox>;
};

type SolvedParams = {
  readonly solved: SolvedDockFrame;
  readonly detailFallback: PanelPairLayout['detail'];
};

export const dockGridFrameOf = ({ solved, detailFallback }: SolvedParams): DockGridFrame => {
  const columns = solved.columns.map((column) => ({
    width: column.box.width,
    dragMax: column.dragMax,
    panes: column.panes.map((pane) => ({ key: pane.id, weight: Math.max(1, pane.box.height) })),
  }));
  return {
    pair: {
      mode: solved.mode === 'push' ? 'push' : 'overlay',
      isDetailOver: solved.mode === 'push' && solved.isDetailOver,
      dock: {
        width: dockGridSpanOf({ columns }),
        dragMax: columns[0]?.dragMax ?? 0,
      },
      detail:
        solved.detail === null
          ? detailFallback
          : { width: solved.detail.box.width, dragMax: solved.detail.dragMax },
    },
    columns,
  };
};
