export const STORAGE_COLUMN = {
  check: 'flex w-4 shrink-0 items-center',
  node: 'flex w-5 shrink-0 items-center',
  size: 'w-16 shrink-0 text-right tabular-nums',
  age: 'w-16 shrink-0 text-right tabular-nums @max-[560px]:hidden',
  status: 'flex w-44 shrink-0 items-center gap-1.5 truncate @max-[720px]:hidden',
  actions: 'flex w-36 shrink-0 items-center justify-end gap-1',
} as const satisfies Record<string, string>;
