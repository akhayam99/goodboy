import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export const setDocumentDrawerExpanded = (set: SetFn) => {
  return (sessionId: SessionId, isExpanded: boolean): void => {
    set((state) =>
      (state.documentDrawerExpanded?.[sessionId] ?? false) === isExpanded
        ? state
        : { documentDrawerExpanded: { ...state.documentDrawerExpanded, [sessionId]: isExpanded } },
    );
  };
};
