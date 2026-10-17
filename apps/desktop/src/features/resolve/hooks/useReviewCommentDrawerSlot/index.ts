import { useSyncExternalStore } from 'react';
import { reviewCommentDrawerSlot } from '../../reviewCommentDrawerSlot';

export const useReviewCommentDrawerSlot = (): HTMLElement | null =>
  useSyncExternalStore(reviewCommentDrawerSlot.subscribe, reviewCommentDrawerSlot.get, () => null);
