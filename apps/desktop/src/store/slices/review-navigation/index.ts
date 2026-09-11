import { consumeReviewTarget } from './consumeReviewTarget';
import { openReviewTarget } from './openReviewTarget';
import { reviewNavigationInitialState } from './state';
import type {
  ConsumeReviewTargetParams,
  GetFn,
  OpenReviewTargetParams,
  ReviewNavigationSlice,
  SetFn,
} from './types';

export { REVIEW_HOME, reviewMountId, reviewPrNumber, reviewThreadId } from './destination';
export type { ReviewDestination } from './destination';
export type {
  ReviewTarget,
  ReviewTargetOutcome,
  ReviewTargetReason,
  ReviewTargetStatus,
} from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const createReviewNavigationSlice = ({ set, get }: Params): ReviewNavigationSlice => ({
  ...reviewNavigationInitialState,
  openReviewTarget: (params: OpenReviewTargetParams) => openReviewTarget({ set, get, ...params }),
  consumeReviewTarget: (params: ConsumeReviewTargetParams) =>
    consumeReviewTarget({ set, ...params }),
});
