import type { SessionId } from '@goodboy/types';
import type { ReviewSelectionState } from './state';

export type { SetFn } from '../../slice-types';

export type SetReviewSelectionParams = {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

export type ToggleReviewSelectionParams = {
  readonly sessionId: SessionId;
  readonly threadId: string;
};

export type ClearReviewSelectionParams = {
  readonly sessionId: SessionId;
};

export type ReviewSelectionSlice = ReviewSelectionState & {
  setReviewSelection(params: SetReviewSelectionParams): void;
  toggleReviewSelection(params: ToggleReviewSelectionParams): void;
  clearReviewSelection(params: ClearReviewSelectionParams): void;
};
