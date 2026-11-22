import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { dockFitProbe } from '../dockFitProbe';
import { dockGridFrameOf, type DockGridFrame, type SolvedDockFrame } from '../dockGridFrameOf';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import { dockGridSpanOf } from '../dockGridSpanOf';
import { dockGridTracksOf } from '../dockGridTracksOf';
import { dockLeadSizingOf } from '../dockLeadSizingOf';
import { dockSplitKeyOf } from '../dockSplitKeyOf';
import type { CanDropParams } from '../dockDropZonesOf';
import { dockMoveFits } from '../dockMoveFits';
import type { DockPairTurn } from '../dockPairTurnContext';
import { DOCK_FOCUS_DETAIL, type DockGridCell, type DockGridSpec } from '../dockGridSpec';
import { DRAWER_TIERS, type DrawerPlacement, type DrawerSizing } from '../drawerGeometry';
import { ArrowLeftRight, ArrowUpDown } from '../icons';
import { routedHandleOf } from '../routedHandleOf';
import { savedHandleOf } from '../savedHandleOf';
import { turnedDockColumnsOf } from '../turnedDockColumnsOf';
import { unmeasuredDockGridOf } from '../unmeasuredDockGridOf';
import type { DrawerTierWidthSet } from '../useDrawerTierWidthSet';
import type { SplitHandleProps } from '../components/SplitHandle';

type Preview = (width: number) => void;

type SolvedPane = {
  readonly id: string;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
};

export type DockSolveParams = {
  readonly columnWidth: number;
  readonly railWidth: number;
  readonly canPush: boolean;
  readonly detail: SolvedPane | null;
  readonly columns: ReadonlyArray<{
    readonly panes: ReadonlyArray<SolvedPane>;
    readonly split?: number;
  }>;
};

type DetailSpec = {
  readonly isShown: boolean;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
};

type Params = {
  readonly columns: ReadonlyArray<ReadonlyArray<DockGridCell>>;
  readonly splits: Readonly<Record<string, number>>;
  readonly cellCount: number;
  readonly onResize: DockGridSpec['onResize'];
  readonly columnWidth: number | null;
  readonly railWidth: number;
  readonly placement: DrawerPlacement;
  readonly detail: DetailSpec;
  readonly tiers: DrawerTierWidthSet;
  readonly route: MutableRefObject<Preview>;
  readonly previewDock: Preview;
  readonly solve: (params: DockSolveParams) => SolvedDockFrame;
  readonly resizeLabel: string;
  readonly isLane?: boolean;
};

type DockGridLayout = {
  readonly cellCount: number;
  readonly frame: DockGridFrame;
  readonly isGrid: boolean;
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly handles: ReadonlyArray<SplitHandleProps | null>;
  readonly canDrop: (params: CanDropParams) => boolean;
  readonly turn: Omit<DockPairTurn, 'onTurn'> | null;
};

type ColumnsParams = {
  readonly columns: ReadonlyArray<ReadonlyArray<DockGridCell>>;
};

type KeysParams = {
  readonly keys: ReadonlyArray<string>;
};

type ColumnPreviewParams = {
  readonly index: number;
  readonly width: number;
  readonly from: ReadonlyArray<DockGridColumnBox>;
};

type CellParams = {
  readonly cell: DockGridCell;
};

type FitParams = {
  readonly solved: SolvedDockFrame | null;
};

const fitsAsDrawn = ({ solved }: FitParams): boolean =>
  solved !== null && solved.mode === 'push' && !solved.isStacked && !solved.isDetailOver;

const STACK_TURN: Omit<DockPairTurn, 'onTurn'> = {
  label: 'Stack the panels',
  icon: ArrowUpDown,
};

const SIDE_TURN: Omit<DockPairTurn, 'onTurn'> = {
  label: 'Put the panels side by side',
  icon: ArrowLeftRight,
};

export const useDockGrid = ({
  columns,
  splits,
  cellCount,
  onResize,
  columnWidth,
  railWidth,
  placement,
  detail,
  tiers,
  route,
  previewDock,
  solve,
  resizeLabel,
  isLane = false,
}: Params): DockGridLayout => {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const savedWidthOf = ({ cell }: CellParams): number =>
    cell.savedWidth ?? tiers[cell.sizing].width;
  const sizingOf = new Map(columns.flat().map((cell) => [cell.key, cell.sizing] as const));
  const leadOf = ({ keys }: KeysParams): DrawerSizing =>
    dockLeadSizingOf({ sizings: keys.map((key) => sizingOf.get(key) ?? 'side') });
  const isAnyShown = columns.length > 0 || detail.isShown;
  const solveColumns = ({ columns: shape }: ColumnsParams): SolvedDockFrame | null =>
    columnWidth === null || !isAnyShown
      ? null
      : solve({
          columnWidth,
          railWidth,
          canPush: placement !== 'overlay',
          detail: detail.isShown
            ? { id: DOCK_FOCUS_DETAIL, sizing: detail.sizing, savedWidth: detail.savedWidth }
            : null,
          columns: shape.map((column) => ({
            panes: column.map((cell) => ({
              id: cell.key,
              sizing: cell.sizing,
              savedWidth: savedWidthOf({ cell }),
            })),
            split: splits[dockSplitKeyOf({ keys: column.map((cell) => cell.key) })],
          })),
        });
  const solved = solveColumns({ columns });
  const detailFallback = {
    width: detail.savedWidth,
    dragMax: DRAWER_TIERS[detail.sizing].max,
  };
  const frame =
    solved === null
      ? unmeasuredDockGridOf({ columns, savedWidthOf, detail: detailFallback, placement })
      : dockGridFrameOf({ solved, detailFallback });
  const isGrid = cellCount > 1 || (isLane && cellCount > 0);
  const turned = isGrid ? turnedDockColumnsOf({ columns }) : null;
  const canTurn =
    turned !== null &&
    fitsAsDrawn({ solved }) &&
    fitsAsDrawn({ solved: solveColumns({ columns: turned }) });
  const cellOf = new Map(columns.flat().map((cell) => [cell.key, cell] as const));
  const canDrop = ({ columns: keys }: CanDropParams): boolean => {
    const next = solveColumns({
      columns: keys.map((column) => column.flatMap((key) => cellOf.get(key) ?? [])),
    });
    return solved === null || next === null || dockMoveFits({ now: solved, next });
  };
  const dropRef = useRef(canDrop);
  dropRef.current = canDrop;
  useEffect(() => {
    if (!isGrid) {
      return undefined;
    }
    return dockFitProbe.publish({
      probe: ({ columns: keys }) => dropRef.current({ columns: keys }),
    });
  }, [isGrid]);
  const boxes = frame.columns;
  const previewColumn = useCallback(
    ({ index, width, from }: ColumnPreviewParams) => {
      const next = from.map((box, at) => (at === index ? { ...box, width } : box));
      gridRef.current?.style.setProperty(
        'grid-template-columns',
        dockGridTracksOf({ columns: next }).columns,
      );
      previewDock(dockGridSpanOf({ columns: next }));
    },
    [previewDock],
  );
  const previewOf =
    ({ index }: Pick<ColumnPreviewParams, 'index'>): Preview =>
    (width) =>
      previewColumn({ index, width, from: boxes });
  const handles = (isLane ? [] : boxes).map((box, index) => {
    const keys = box.panes.map((pane) => pane.key);
    const sizing = leadOf({ keys });
    const routed = routedHandleOf({
      handle: savedHandleOf({
        handle: tiers[sizing].handleProps,
        key: keys.find((key) => sizingOf.get(key) === sizing) ?? null,
        baseWidth: DRAWER_TIERS[sizing].fallback,
        onResize,
      }),
      route,
      preview: previewOf({ index }),
    });
    return {
      ...routed,
      value: box.width,
      max: Math.max(routed.min, box.dragMax),
      side: 'right',
      ariaLabel: index === 0 ? resizeLabel : `${resizeLabel} ${index + 1}`,
    } satisfies SplitHandleProps;
  });
  return {
    cellCount,
    frame,
    isGrid,
    gridRef,
    handles,
    canDrop,
    turn: canTurn ? (columns.length === 2 ? STACK_TURN : SIDE_TURN) : null,
  };
};
