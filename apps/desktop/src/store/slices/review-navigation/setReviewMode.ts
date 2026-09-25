import type { SetFn, SetReviewModeParams } from './types';

type Params = { readonly set: SetFn } & SetReviewModeParams;

export const setReviewMode = ({ set, sessionId, mode }: Params): void => {
  set((state) => {
    const current = state.reviewModes[sessionId] ?? 'queue';
    if (current === mode) {
      return state;
    }
    return { reviewModes: { ...state.reviewModes, [sessionId]: mode } };
  });
};
