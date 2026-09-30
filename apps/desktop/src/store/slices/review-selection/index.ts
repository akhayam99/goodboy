import { reviewSelectionInitialState } from './state';
import type {
  ClearReviewSelectionParams,
  ReviewSelectionSlice,
  SetReviewSelectionParams,
  ToggleReviewSelectionParams,
} from './types';
import type { SliceDeps } from '../../slice-types';

const EMPTY: ReadonlyArray<string> = [];

export const createReviewSelectionSlice = ({ set }: SliceDeps): ReviewSelectionSlice => ({
  ...reviewSelectionInitialState,
  setReviewSelection: ({ sessionId, threadIds }: SetReviewSelectionParams) =>
    set((state) => {
      const next = [...new Set(threadIds)];
      const current = state.reviewSelection[sessionId] ?? EMPTY;
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return state;
      }
      return { reviewSelection: { ...state.reviewSelection, [sessionId]: next } };
    }),
  toggleReviewSelection: ({ sessionId, threadId }: ToggleReviewSelectionParams) =>
    set((state) => {
      const current = state.reviewSelection[sessionId] ?? EMPTY;
      const next = current.includes(threadId)
        ? current.filter((id) => id !== threadId)
        : [...current, threadId];
      return { reviewSelection: { ...state.reviewSelection, [sessionId]: next } };
    }),
  clearReviewSelection: ({ sessionId }: ClearReviewSelectionParams) =>
    set((state) => {
      if ((state.reviewSelection[sessionId] ?? EMPTY).length === 0) {
        return state;
      }
      return { reviewSelection: { ...state.reviewSelection, [sessionId]: [] } };
    }),
});
