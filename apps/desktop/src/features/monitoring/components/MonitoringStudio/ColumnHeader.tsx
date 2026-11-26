import { cn } from '@goodboy/ui';
import { isPortColumnShown } from './isPortColumnShown';
import { PORT_GRIDS } from './portGrid';
import { usePortColumns } from './usePortColumns';

const CELL = 'min-w-0 truncate';
const END_CELL = 'min-w-0 truncate text-right';

type Props = Record<never, never>;

export const ColumnHeader = ({}: Props) => {
  const columns = usePortColumns({});
  return (
    <div
      data-column-header
      className={cn(
        PORT_GRIDS[columns],
        'sticky-surface sticky top-0 z-20 min-h-6 text-meta text-faint-foreground',
      )}
    >
      <span />
      <span className={CELL}>Port</span>
      {isPortColumnShown({ columns, column: 'label' }) ? <span className={CELL}>Label</span> : null}
      <span className={CELL}>Opened by</span>
      <span className={CELL}>Process</span>
      {isPortColumnShown({ columns, column: 'up' }) ? <span className={END_CELL}>Up</span> : null}
      {isPortColumnShown({ columns, column: 'cpu' }) ? <span className={END_CELL}>CPU</span> : null}
      {isPortColumnShown({ columns, column: 'memory' }) ? (
        <span className={END_CELL}>Memory</span>
      ) : null}
      <span />
    </div>
  );
};
