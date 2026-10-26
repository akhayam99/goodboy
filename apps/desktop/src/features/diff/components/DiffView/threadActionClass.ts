import { FOCUS_RING, cn } from '@goodboy/ui';
export const THREAD_ACTION_CLASS = cn(
  'rounded-sm px-1 text-chip text-muted-foreground transition-colors hover:bg-hover hover:text-foreground',
  FOCUS_RING,
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
);

export const THREAD_PRIMARY_ACTION_CLASS = cn(
  'rounded-sm px-2 text-meta transition-[filter] hover:brightness-110',
  FOCUS_RING,
);
