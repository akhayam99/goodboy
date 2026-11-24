import type { Tone } from '../../tint';

export type ActivityRowTone = 'quiet' | 'live' | 'attention' | 'failed' | 'pending';

export type ActivityRowDensity = 'rail' | 'feed';

export type ActivityRowOrdinalSlot = 'narrow' | 'wide';

export type ActivityRowTextSize = 'ui' | 'body';

export type ActivityMetaColumn = 'state' | 'model' | 'time' | 'cost';

export const ACTIVITY_ROW_BAR_TONE: Record<ActivityRowTone, Tone | null> = {
  quiet: null,
  live: null,
  attention: 'warning',
  failed: 'danger',
  pending: null,
};

export const ACTIVITY_ROW_TEXT_TONE: Record<ActivityRowTone, string> = {
  quiet: 'text-foreground',
  live: 'text-foreground',
  attention: 'text-foreground',
  failed: 'text-foreground',
  pending: 'text-muted-foreground',
};

export const ACTIVITY_ROW_DENSITY: Record<
  ActivityRowDensity,
  { readonly row: string; readonly text: string; readonly slot: string }
> = {
  rail: { row: 'items-start py-1', text: 'line-clamp-2', slot: 'flex h-5 shrink-0 items-center' },
  feed: { row: 'h-full items-center', text: 'truncate', slot: 'flex shrink-0 items-center' },
};

export const ACTIVITY_ROW_ORDINAL: Record<ActivityRowOrdinalSlot, string> = {
  narrow: 'w-6 justify-end text-chip',
  wide: 'w-12 justify-start text-meta',
};

export const ACTIVITY_ROW_TEXT_SIZE: Record<ActivityRowTextSize, string> = {
  ui: 'text-ui',
  body: 'text-body',
};

export const ACTIVITY_META_ORDER: ReadonlyArray<ActivityMetaColumn> = [
  'state',
  'model',
  'time',
  'cost',
];

export const ACTIVITY_META_WIDTH: Record<ActivityMetaColumn, string> = {
  state: 'w-24',
  model: 'w-28 @max-[640px]:hidden',
  time: 'w-16 @max-[500px]:hidden',
  cost: 'w-12 @max-[620px]:hidden',
};

export const ACTIVITY_META_TONE: Record<ActivityMetaColumn, string> = {
  state: 'justify-end',
  model: 'justify-start text-muted-foreground',
  time: 'justify-end tabular-nums text-faint-foreground',
  cost: 'justify-end tabular-nums text-faint-foreground',
};

export const ACTIVITY_MESSAGE_BUBBLE = {
  read: 'bg-fill text-foreground',
  pending: 'bg-transparent text-muted-foreground ring-1 ring-inset ring-border',
} as const satisfies Record<string, string>;
