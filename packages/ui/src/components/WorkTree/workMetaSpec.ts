export const WORK_ROW = {
  container: '@container',
  stateFull: '@max-[880px]:hidden',
  stateShort: '@min-[880px]:hidden',
  chipLabel: '@max-[520px]:sr-only',
  chipBox: 'min-w-24 @max-[520px]:min-w-0',
  kindChip: '@max-[520px]:w-auto',
  title: 'min-w-16',
  state: '@max-[320px]:hidden',
  hint: 'hidden @min-[640px]:group-hover:inline @min-[640px]:group-focus-within:inline',
} as const satisfies Record<string, string>;

export const WORK_META_COLUMN = {
  routing:
    'flex w-34 shrink-0 items-center gap-1 overflow-hidden @max-[440px]:w-3 @max-[360px]:hidden',
  routingName: 'min-w-0 truncate @max-[440px]:sr-only',
  routingDetail: 'flex shrink-0 items-center gap-1 @max-[720px]:sr-only',
  time: 'w-24 shrink-0 truncate text-right @max-[640px]:w-20 @max-[360px]:hidden',
  cost: 'w-14 shrink-0 truncate text-right @max-[560px]:hidden',
  costRange: 'w-18 shrink-0 truncate text-right @max-[560px]:hidden',
  action: 'flex min-w-19 shrink-0 items-center justify-end',
  menu: 'flex w-6 shrink-0 items-center justify-end',
} as const satisfies Record<string, string>;
