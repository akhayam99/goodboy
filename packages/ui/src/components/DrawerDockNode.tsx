import type { ReactNode } from 'react';
import type { DockGridSpec } from '../dockGridSpec';
import type { useDockFrame } from '../useDockFrame';
import { DockGrid } from './DockGrid';

type Props = {
  readonly dockGrid: DockGridSpec | null;
  readonly frame: ReturnType<typeof useDockFrame>;
  readonly drawer: ReactNode;
  readonly isFloating: boolean;
};

export const DrawerDockNode = ({ dockGrid, frame, drawer, isFloating }: Props) => {
  const { grid, cells } = frame;
  if (dockGrid === null || cells.length === 0) {
    return drawer;
  }
  return (
    <DockGrid
      gridRef={grid.gridRef}
      spec={dockGrid}
      cell={drawer}
      columns={grid.frame.columns}
      handles={grid.handles}
      isFramed={grid.isGrid}
      isFocusShown={frame.isFocusShown}
      isFloating={isFloating}
      canDrop={grid.canDrop}
      boxesOf={grid.boxesOf}
    />
  );
};
