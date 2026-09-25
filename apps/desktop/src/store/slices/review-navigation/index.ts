import { consumeReviewTarget } from './consumeReviewTarget';
import { openReviewTarget } from './openReviewTarget';
import { reviewNavigationInitialState } from './state';
import { setReviewMode } from './setReviewMode';
import type {
  ConsumeReviewTargetParams,
  GetFn,
  OpenReviewTargetParams,
  ReviewNavigationSlice,
  SetFn,
  SetReviewModeParams,
} from './types';

export { reviewThreadId } from './destination';
export type { ReviewDestination } from './destination';
export type { ReviewTargetOutcome, ReviewTargetReason } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const createReviewNavigationSlice = ({ set, get }: Params): ReviewNavigationSlice => ({
  ...reviewNavigationInitialState,
  openReviewTarget: (params: OpenReviewTargetParams) => openReviewTarget({ set, get, ...params }),
  consumeReviewTarget: (params: ConsumeReviewTargetParams) =>
    consumeReviewTarget({ set, ...params }),
  setReviewMode: (params: SetReviewModeParams) => setReviewMode({ set, ...params }),
});
