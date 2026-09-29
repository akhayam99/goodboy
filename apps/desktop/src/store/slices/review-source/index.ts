import { refreshReviewSource } from './refreshReviewSource';
import { selectReviewSource } from './selectReviewSource';
import type {
  GetFn,
  RefreshReviewSourceParams,
  ReviewSourceSlice,
  SelectReviewSourceParams,
  SetFn,
} from './types';

export { reviewSourceInitialState } from './state';
export type { ReviewSourceState } from './state';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const createReviewSourceSlice = ({ set, get }: Params): ReviewSourceSlice => ({
  selectReviewSource: (params: SelectReviewSourceParams) =>
    selectReviewSource({ set, get, ...params }),
  refreshReviewSource: (params: RefreshReviewSourceParams) =>
    refreshReviewSource({ set, get, ...params }),
});
