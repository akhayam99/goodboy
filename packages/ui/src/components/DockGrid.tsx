import type { CSSProperties, ReactNode, Ref } from 'react';
import { DockCellContext } from '../dockCellContext';
import { cn } from '../cn';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import { dockGridTracksOf } from '../dockGridTracksOf';
import { DockPairTurnContext, type DockPairTurn } from '../dockPairTurnContext';
import type { DockGridSpec } from '../dockGridSpec';
import { SplitHandle, type SplitHandleProps } from './SplitHandle';

type Props = {
  readonly gridRef: Ref<HTMLDivElement>;
  readonly spec: DockGridSpec;
  readonly cell: ReactNode;
  readonly columns: ReadonlyArray<DockGridColumnBox>;
  readonly handles: ReadonlyArray<SplitHandleProps | null>;
  readonly turn: Omit<DockPairTurn, 'onTurn'> | null;
  readonly isFramed: boolean;
  readonly isFocusShown: boolean;
  readonly isFloating: boolean;
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
}: Props) => {
  const tracks = dockGridTracksOf({ columns });
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
              )}
            >
              <DockPairTurnContext.Provider
                value={
                  turn === null ? null : { ...turn, onTurn: () => spec.onTurn({ key: pane.key }) }
                }
              >
                <DockCellContext.Provider value={pane.key}>{cell}</DockCellContext.Provider>
              </DockPairTurnContext.Provider>
            </div>
          );
        });
        return gutter === null ? panes : [gutter, ...panes];
      })}
    </div>
  );
};
