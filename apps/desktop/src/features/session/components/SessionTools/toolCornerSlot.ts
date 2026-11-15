const CORNER_BOX =
  'pointer-events-none absolute -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center';

export const TOOL_CORNER_SLOT = {
  end: `${CORNER_BOX} left-1/2 translate-x-1.5`,
  start: `${CORNER_BOX} right-1/2 -translate-x-1.5`,
} as const;
