import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../cn';
import { ListGridColumnsContext } from './ListGridColumnsContext';
import { listGridTemplate, type ListGridColumn } from './listGridTemplate';
import { useFilledColumns } from './useFilledColumns';
import { useGridWidth } from './useGridWidth';

export type ListGridProps = {
  readonly label: string;
  readonly columns: ReadonlyArray<ListGridColumn>;
  readonly isGrouped?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
};

const ROW_SELECTOR = '[data-list-grid-row]';

const STEP_FOR_KEY: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
  const step = STEP_FOR_KEY[event.key];
  if (step === undefined) {
    return;
  }
  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ROW_SELECTOR));
  const index = rows.findIndex((row) => row === document.activeElement);
  if (index === -1) {
    return;
  }
  const next = rows[index + step];
  if (next === undefined) {
    return;
  }
  event.preventDefault();
  next.focus();
};

export const ListGrid = ({
  label,
  columns,
  isGrouped = false,
  children,
  className,
}: ListGridProps) => {
  const filled = useFilledColumns({ columns });
  const gridRef = useRef<HTMLUListElement>(null);
  const isWatched = columns.some((column) => column.hideBelow !== undefined);
  const width = useGridWidth({ ref: gridRef, isWatched });
  const value = useMemo(() => {
    const narrow = columns.filter(
      (column) => column.hideBelow !== undefined && width > 0 && width < column.hideBelow,
    );
    if (narrow.length === 0) {
      return filled;
    }
    return {
      ...filled,
      hiddenKeys: new Set([...filled.hiddenKeys, ...narrow.map((column) => column.key)]),
    };
  }, [columns, filled, width]);
  return (
    <ListGridColumnsContext.Provider value={value}>
      <ul
        ref={gridRef}
        aria-label={label}
        data-list-grid=""
        onKeyDown={moveFocus}
        style={{
          gridTemplateColumns: `0px ${listGridTemplate({ columns, hiddenKeys: value.hiddenKeys })} 0px`,
        }}
        className={cn('grid min-w-0 gap-x-3 text-ui', isGrouped ? 'gap-y-8' : 'gap-y-0', className)}
      >
        {children}
      </ul>
    </ListGridColumnsContext.Provider>
  );
};
