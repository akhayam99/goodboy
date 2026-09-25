export const ARTIFACT_COLUMN = {
  check: 'flex w-4 shrink-0 items-center',
  node: 'flex w-5 shrink-0 items-center',
  workspace: 'w-24 shrink-0 truncate @max-[720px]:hidden',
  age: 'w-20 shrink-0 text-right tabular-nums @max-[560px]:hidden',
  size: 'w-16 shrink-0 text-right tabular-nums',
  actions: 'flex w-44 shrink-0 items-center justify-end gap-1',
} as const satisfies Record<string, string>;
