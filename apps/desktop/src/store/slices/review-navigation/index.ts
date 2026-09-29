import { consumeReviewTarget } from './consumeReviewTarget';
import { openReviewTarget } from './openReviewTarget';
import { reviewNavigationInitialState } from './state';
import { setPullRequestMode } from './setPullRequestMode';
import { setReviewSelection } from './setReviewSelection';
import type {
  ConsumeReviewTargetParams,
  GetFn,
  OpenReviewTargetParams,
  ReviewNavigationSlice,
  SetFn,
  SetPullRequestModeParams,
  SetReviewSelectionParams,
} from './types';

export { reviewFocusThreadId } from './destination';
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
  setPullRequestMode: (params: SetPullRequestModeParams) => setPullRequestMode({ set, ...params }),
  setReviewSelection: (params: SetReviewSelectionParams) => setReviewSelection({ set, ...params }),
});
