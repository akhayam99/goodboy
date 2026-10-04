export const WORK_ROW = {
  container: '@container',
  chipLabel: '@max-[520px]:sr-only',
  kindChip: '@max-[520px]:w-auto',
  title: 'min-w-16',
  label: 'min-w-40 @max-[440px]:min-w-0',
  state: '@max-[320px]:hidden',
  stateSlot:
    'flex w-28 shrink-0 items-center justify-end whitespace-nowrap @max-[790px]:w-24 @max-[320px]:hidden',
} as const satisfies Record<string, string>;

export const WORK_META_COLUMN = {
  routing:
    'flex w-34 shrink-0 items-center justify-end gap-1 overflow-hidden @max-[840px]:w-auto @max-[360px]:hidden',
  routingName: 'min-w-0 truncate @max-[840px]:sr-only',
  routingDetail: 'flex shrink-0 items-center gap-1 @max-[840px]:sr-only',
  progress:
    'flex w-34 shrink-0 items-center justify-end overflow-hidden @max-[840px]:w-auto @max-[360px]:hidden',
  progressText: 'min-w-0 truncate',
  time: 'w-20 shrink-0 truncate text-right @max-[500px]:hidden',
  timeSuffix: '@max-[640px]:sr-only',
  cost: 'w-12 shrink-0 truncate text-right @max-[620px]:hidden',
  costRange: 'w-18 shrink-0 truncate text-right @max-[620px]:hidden',
  action: 'flex min-w-19 shrink-0 items-center justify-end',
  menu: 'flex w-6 shrink-0 items-center justify-end',
} as const satisfies Record<string, string>;
