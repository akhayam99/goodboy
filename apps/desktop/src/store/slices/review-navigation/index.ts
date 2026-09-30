import { consumeReviewTarget } from './consumeReviewTarget';
import { openReviewTarget } from './openReviewTarget';
import { reviewNavigationInitialState } from './state';
import { setPullRequestMode } from './setPullRequestMode';
import type {
  ConsumeReviewTargetParams,
  OpenReviewTargetParams,
  ReviewNavigationSlice,
  SetPullRequestModeParams,
} from './types';
import type { SliceDeps } from '../../slice-types';

export { reviewFocusThreadId } from './destination';
export type { ReviewDestination } from './destination';
export type { ReviewTargetOutcome, ReviewTargetReason } from './types';

export const createReviewNavigationSlice = ({ set, get }: SliceDeps): ReviewNavigationSlice => ({
  ...reviewNavigationInitialState,
  openReviewTarget: (params: OpenReviewTargetParams) => openReviewTarget({ set, get, ...params }),
  consumeReviewTarget: (params: ConsumeReviewTargetParams) =>
    consumeReviewTarget({ set, ...params }),
  setPullRequestMode: (params: SetPullRequestModeParams) => setPullRequestMode({ set, ...params }),
});
