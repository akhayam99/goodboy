import { cn } from '@goodboy/ui';
import { PORT_GRID } from './portGrid';

const CELL = 'min-w-0 truncate';
const END_CELL = 'min-w-0 truncate text-right';

type Props = Record<never, never>;

export const ColumnHeader = ({}: Props) => (
  <div
    data-column-header
    className={cn(
      PORT_GRID,
      'sticky-surface sticky top-[var(--reveal-inset,0px)] z-20 min-h-6 text-meta text-faint-foreground',
    )}
  >
    <span />
    <span className={CELL}>Port</span>
    <span className={CELL}>Label</span>
    <span className={CELL}>Opened by</span>
    <span className={CELL}>Process</span>
    <span className={END_CELL}>Up</span>
    <span className={END_CELL}>CPU</span>
    <span className={END_CELL}>Memory</span>
    <span />
  </div>
);
