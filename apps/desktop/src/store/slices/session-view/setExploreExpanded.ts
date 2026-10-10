import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string;
  readonly path: string;
  readonly isExpanded: boolean;
};

export const setExploreExpanded = (set: SetFn) => {
  return ({ sessionId, mountPath, path, isExpanded }: Params): void => {
    set((state) => {
      const ofSession = state.exploreExpanded[sessionId] ?? {};
      const current = ofSession[mountPath] ?? {};
      if ((current[path] ?? false) === isExpanded) {
        return state;
      }
      const next = isExpanded
        ? { ...current, [path]: true }
        : Object.fromEntries(Object.entries(current).filter(([key]) => key !== path));
      return {
        exploreExpanded: {
          ...state.exploreExpanded,
          [sessionId]: { ...ofSession, [mountPath]: next },
        },
      };
    });
  };
};
