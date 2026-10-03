import type { ProjectId } from '@goodboy/types';

export const SCRIPT_PINS_PREFIX = 'scripts.pinned.';

export const scriptPinsKey = ({ projectId }: { readonly projectId: ProjectId }): string =>
  `${SCRIPT_PINS_PREFIX}${projectId}`;
