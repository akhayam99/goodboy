import type { SliceDeps } from '../../slice-types';
import type { LatestOnly } from '../../runtime/state-writes/latestOnly';

export type CompanionLinkDeps = SliceDeps & {
  readonly latest: LatestOnly;
};
