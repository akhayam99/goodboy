import type { SetFn, SetReviewSelectionParams } from './types';

type Params = { readonly set: SetFn } & SetReviewSelectionParams;

export const setReviewSelection = ({ set, sessionId, threadIds }: Params): void => {
  const unique = [...new Set(threadIds)];
  set((state) => ({ reviewSelections: { ...state.reviewSelections, [sessionId]: unique } }));
};
