import type { WorktreeStatus } from '@goodboy/types';
import { distanceAhead, distanceBehind } from '../../shared/lib/gitStatus';

type Params = {
  readonly status: WorktreeStatus | null;
};

export const isInSyncWithOrigin = ({ status }: Params): boolean =>
  status !== null &&
  status.upstream !== null &&
  distanceAhead({ distance: status.upstreamDistance }) === 0 &&
  distanceBehind({ distance: status.upstreamDistance }) === 0;
