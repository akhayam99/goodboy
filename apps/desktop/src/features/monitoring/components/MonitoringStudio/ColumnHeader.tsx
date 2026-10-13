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
      'sticky top-0 z-20 min-h-6 bg-background text-meta text-faint-foreground',
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
