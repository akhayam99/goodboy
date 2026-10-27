import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';

export const TRAIL_CRUMB_CLASS = cn(
  'inline-flex min-w-0 items-center truncate rounded-sm px-1 py-0.5 text-meta transition-colors',
  FOCUS_RING,
);

export const TRAIL_LINK_CLASS = 'text-faint-foreground hover:bg-hover hover:text-foreground';

export const TRAIL_CURRENT_CLASS = 'flex-1 text-foreground';

export const TRAIL_TAIL_CLASS =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-faint-foreground transition-colors duration-120 ease-out';
