import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly path: string;
  readonly isExpanded: boolean;
};

export const setExploreExpanded = (set: SetFn) => {
  return ({ sessionId, path, isExpanded }: Params): void => {
    set((state) => {
      const current = state.exploreExpanded[sessionId] ?? {};
      if ((current[path] ?? false) === isExpanded) {
        return state;
      }
      const next = isExpanded
        ? { ...current, [path]: true }
        : Object.fromEntries(Object.entries(current).filter(([key]) => key !== path));
      return { exploreExpanded: { ...state.exploreExpanded, [sessionId]: next } };
    });
  };
};
