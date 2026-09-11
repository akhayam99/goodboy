import type { ConsumeReviewTargetParams, SetFn } from './types';

type Params = { readonly set: SetFn } & ConsumeReviewTargetParams;

export const consumeReviewTarget = ({ set, sessionId, requestId }: Params): void => {
  set((state) => {
    const current = state.reviewTargets[sessionId] ?? null;
    if (current === null || current.requestId !== requestId) {
      return state;
    }
    return { reviewTargets: { ...state.reviewTargets, [sessionId]: null } };
  });
};
