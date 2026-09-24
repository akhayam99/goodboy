export const WORK_META_COLUMN = {
  model: 'flex w-24 shrink-0 items-center gap-1 overflow-hidden @max-[600px]:w-3',
  modelLabel: 'min-w-0 truncate @max-[600px]:sr-only',
  effort: 'w-13 shrink-0 truncate text-faint-foreground @max-[720px]:sr-only',
  time: 'w-28 shrink-0 truncate text-right',
  cost: 'w-14 shrink-0 truncate text-right',
  stepCost: '@max-[520px]:hidden',
  action: 'flex min-w-19 shrink-0 items-center justify-end',
} as const satisfies Record<string, string>;
