import type { SessionId } from '@goodboy/types';

export type ReviewSelectionState = {
  readonly reviewSelection: Readonly<Record<SessionId, ReadonlyArray<string>>>;
};

export const reviewSelectionInitialState: ReviewSelectionState = {
  reviewSelection: {},
};
