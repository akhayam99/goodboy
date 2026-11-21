import { useMemo, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { DockCellContext } from '../dockCellContext';
import { cn } from '../cn';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import { dockGridTracksOf } from '../dockGridTracksOf';
import { DockPairTurnContext, type DockPairTurn } from '../dockPairTurnContext';
import type { DockGridSpec } from '../dockGridSpec';
import { DockDragContext, type DockDragSource } from '../dockDragContext';
import type { CanDropParams } from '../dockDropZonesOf';
import { useDockDrag } from '../useDockDrag';
import { DockDropZones } from './DockDropZones';
import { DockRowHandle } from './DockRowHandle';
import { SplitHandle, type SplitHandleProps } from './SplitHandle';

type Props = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly spec: DockGridSpec;
  readonly cell: ReactNode;
  readonly columns: ReadonlyArray<DockGridColumnBox>;
  readonly handles: ReadonlyArray<SplitHandleProps | null>;
  readonly turn: Omit<DockPairTurn, 'onTurn'> | null;
  readonly isFramed: boolean;
  readonly isFocusShown: boolean;
  readonly isFloating: boolean;
  readonly canDrop: (params: CanDropParams) => boolean;
};

const SINGLE_TRACK = 'minmax(0,1fr)';

export const DockGrid = ({
  gridRef,
  spec,
  cell,
  columns,
  handles,
  turn,
  isFramed,
  isFocusShown,
  isFloating,
  canDrop,
}: Props) => {
  const tracks = dockGridTracksOf({ columns });
  const keys = columns.map((column) => column.panes.map((pane) => pane.key));
  const canMove = isFramed && spec.onMove !== undefined;
  const drag = useDockDrag({
    gridRef,
    columns: keys,
    canDrop,
    onMove: canMove ? (spec.onMove ?? null) : null,
  });
  const keyList = keys.flat().join('/');
  const startDrag = drag.start;
  const sources = useMemo(
    () =>
      new Map<string, DockDragSource>(
        canMove
          ? keyList
              .split('/')
              .map((key) => [key, { onStart: ({ event }) => startDrag({ key, event }) }])
          : [],
      ),
    [canMove, keyList, startDrag],
  );
  const style: CSSProperties = isFramed
    ? { gridTemplateColumns: tracks.columns, gridTemplateRows: tracks.rows }
    : { gridTemplateColumns: SINGLE_TRACK, gridTemplateRows: SINGLE_TRACK };
  return (
    <div ref={gridRef} data-dock-grid="" style={style} className="grid min-h-0 min-w-0 flex-1">
      {columns.flatMap((column, index) => {
        const handle = handles[index] ?? null;
        const gutter =
          index > 0 && isFramed ? (
            <div
              key={`gutter-${index}`}
              data-dock-gutter=""
              style={{ gridColumn: index * 2, gridRow: '1 / -1' }}
              className="flex min-h-0 justify-center"
            >
              {handle === null ? null : <SplitHandle {...handle} />}
            </div>
          ) : null;
        const panes = column.panes.map((pane, row) => {
          const isFocused = isFocusShown && spec.focus === pane.key;
          const isAlone = column.panes.length === 1;
          return (
            <div
              key={pane.key}
              data-dock-pane={pane.key}
              data-dock-focus={pane.key}
              data-panel-focused={isFocused ? '' : undefined}
              data-dock-lifted={drag.liftedKey === pane.key ? '' : undefined}
              tabIndex={-1}
              onFocusCapture={() => spec.onFocus({ key: pane.key })}
              onPointerDownCapture={() => spec.onFocus({ key: pane.key })}
              style={
                isFramed
                  ? { gridColumn: index * 2 + 1, gridRow: isAlone ? '1 / -1' : row * 2 + 1 }
                  : undefined
              }
              className={cn(
                'relative flex min-h-0 min-w-0 flex-col overflow-clip focus-visible:outline-none',
                isFramed && 'rounded-frame border bg-drawer',
                isFramed && (isFocused ? 'border-focus-ring' : 'border-frame-edge'),
                isFramed && isFloating && 'shadow-xl',
                drag.liftedKey === pane.key && 'opacity-50',
              )}
            >
              <DockPairTurnContext.Provider
                value={
                  turn === null ? null : { ...turn, onTurn: () => spec.onTurn({ key: pane.key }) }
                }
              >
                <DockDragContext.Provider value={sources.get(pane.key) ?? null}>
                  <DockCellContext.Provider value={pane.key}>{cell}</DockCellContext.Provider>
                </DockDragContext.Provider>
              </DockPairTurnContext.Provider>
            </div>
          );
        });
        const [top, bottom] = column.panes;
        const rowHandle =
          isFramed && spec.onSplit !== undefined && top !== undefined && bottom !== undefined ? (
            <DockRowHandle
              key={`row-${index}`}
              gridRef={gridRef}
              gridColumn={index * 2 + 1}
              keys={[top.key, bottom.key]}
              topWeight={top.weight}
              bottomWeight={bottom.weight}
              onSplit={spec.onSplit}
            />
          ) : null;
        return [
          ...(gutter === null ? [] : [gutter]),
          ...panes,
          ...(rowHandle === null ? [] : [rowHandle]),
        ];
      })}
      {drag.liftedKey === null ? null : <DockDropZones store={drag.store} />}
    </div>
  );
};
