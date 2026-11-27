import { COUNT_BADGE_CORNER } from '@goodboy/ui';

const CORNER_BOX = 'flex h-3.5 min-w-3.5 items-center justify-center';

export const TOOL_CORNER_SLOT = {
  end: `${COUNT_BADGE_CORNER.end} ${CORNER_BOX}`,
} as const;
