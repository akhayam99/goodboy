import type { RefObject } from 'react';
import { DOCK_ROW_MIN_PX } from '../dockRowMin';
import type { DockGridSplit } from '../dockGridSpec';
import { DRAWER_GUTTER } from '../drawerGeometry';
import { useDockGridHeight } from '../useDockGridHeight';
import { SplitHandle } from './SplitHandle';

type Props = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly gridColumn: number;
  readonly keys: ReadonlyArray<string>;
  readonly topWeight: number;
  readonly bottomWeight: number;
  readonly onSplit: (params: DockGridSplit) => void;
};

type RowsParams = {
  readonly top: string;
  readonly bottom: string;
};

const rowsOf = ({ top, bottom }: RowsParams): string => `${top} ${DRAWER_GUTTER}px ${bottom}`;

export const DockRowHandle = ({
  gridRef,
  gridColumn,
  keys,
  topWeight,
  bottomWeight,
  onSplit,
}: Props) => {
  const height = useDockGridHeight({ gridRef });
  if (height === null) {
    return null;
  }
  const shared = Math.max(0, height - DRAWER_GUTTER);
  const max = Math.max(DOCK_ROW_MIN_PX, shared - DOCK_ROW_MIN_PX);
  const value = Math.round((shared * topWeight) / Math.max(1, topWeight + bottomWeight));
  const setRows = ({ top, bottom }: RowsParams): void => {
    gridRef.current?.style.setProperty('grid-template-rows', rowsOf({ top, bottom }));
  };
  return (
    <div
      data-dock-row-gutter=""
      style={{ gridColumn, gridRow: 2 }}
      className="flex min-w-0 items-center"
    >
      <SplitHandle
        side="top"
        value={value}
        min={DOCK_ROW_MIN_PX}
        max={max}
        ariaLabel="Resize panel height"
        onChange={(size) => setRows({ top: `${size}px`, bottom: 'minmax(0,1fr)' })}
        onCommit={(size) => {
          const share = shared === 0 ? 0.5 : size / shared;
          setRows({ top: `minmax(0,${share}fr)`, bottom: `minmax(0,${1 - share}fr)` });
          onSplit({ keys, share });
        }}
        onReset={() => onSplit({ keys, share: null })}
      />
    </div>
  );
};
