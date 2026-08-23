export const VITAL_CHIP_FRAME =
  'inline-flex h-6 shrink-0 items-center rounded-md border border-border-soft bg-muted/30 text-2xs text-muted-foreground motion-safe:transition-colors';

export const VITAL_CHIP_HOVER = 'hover:border-border hover:bg-muted/50 hover:text-foreground';

export const VITAL_CHIP_FOCUS =
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]';

export const VITAL_CHIP = `${VITAL_CHIP_FRAME} gap-1.5 px-2 ${VITAL_CHIP_HOVER} ${VITAL_CHIP_FOCUS}`;
