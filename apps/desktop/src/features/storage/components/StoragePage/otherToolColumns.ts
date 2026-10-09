export const OTHER_TOOL_COLUMN = {
  grid: 'grid-cols-[28px_minmax(0,1fr)_96px_220px_auto]',
  count: 'whitespace-nowrap text-right text-meta tabular-nums text-muted-foreground',
  size: 'shrink-0 whitespace-nowrap text-label tabular-nums text-foreground',
} as const satisfies Record<string, string>;
