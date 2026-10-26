import { refreshReviewSource } from './refreshReviewSource';
import { selectReviewSource } from './selectReviewSource';
import { sweepRequests } from './sweepRequests';
import type {
  RefreshReviewSourceParams,
  ReviewSourceSlice,
  SelectReviewSourceParams,
} from './types';
import type { SliceDeps } from '../../slice-types';

export { reviewSourceInitialState } from './state';

export const createReviewSourceSlice = ({ set, get }: SliceDeps): ReviewSourceSlice => ({
  selectReviewSource: (params: SelectReviewSourceParams) =>
    selectReviewSource({ set, get, ...params }),
  refreshReviewSource: (params: RefreshReviewSourceParams) =>
    refreshReviewSource({ set, get, ...params }),
  sweepRequests: sweepRequests({ set, get }),
});
