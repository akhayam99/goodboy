import { SESSION_DRAFT_PLACE } from '../navigation/place';
import type { GetFn } from './types';

export const openSessionDraft = (get: GetFn) => {
  return (): void => {
    const state = get();
    if (state.currentWorkspaceId === null) {
      return;
    }
    state.navigate({ to: SESSION_DRAFT_PLACE });
  };
};
