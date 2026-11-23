import { dockLayoutOf } from './dockLayout';
import type { SolvedDockFrame } from './dockGridFrameOf';
import type { DockSolveParams } from './useDockGrid';

type Params = {
  readonly isLane: boolean;
};

const ROW_WEIGHT_FRAME = 1000;

const solveDesk = ({ columnWidth, detail, columns }: DockSolveParams): SolvedDockFrame =>
  dockLayoutOf({
    windowWidth: columnWidth,
    windowHeight: ROW_WEIGHT_FRAME,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: 0,
    isDesk: true,
    detail,
    columns,
  });

const solveDock = ({
  columnWidth,
  railWidth,
  canPush,
  detail,
  columns,
}: DockSolveParams): SolvedDockFrame =>
  dockLayoutOf({
    windowWidth: columnWidth,
    windowHeight: ROW_WEIGHT_FRAME,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: railWidth,
    canPush,
    detail,
    columns,
  });

export const dockSolverOf = ({ isLane }: Params): ((params: DockSolveParams) => SolvedDockFrame) =>
  isLane ? solveDesk : solveDock;
