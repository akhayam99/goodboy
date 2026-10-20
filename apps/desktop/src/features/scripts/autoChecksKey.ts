import type { ProjectId } from '@goodboy/types';

export const AUTO_CHECKS_PREFIX = 'scripts.autoChecks.';

type Params = {
  readonly projectId: ProjectId;
};

export const autoChecksKey = ({ projectId }: Params): string => `${AUTO_CHECKS_PREFIX}${projectId}`;
