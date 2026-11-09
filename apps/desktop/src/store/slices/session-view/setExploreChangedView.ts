import type { SliceDeps } from '../../slice-types';
import type { SetExploreChangedViewParams } from './types';

export const setExploreChangedView = ({ set }: Pick<SliceDeps, 'set'>) => {
  return ({ sessionId, view }: SetExploreChangedViewParams): void => {
    set((state) => ({ exploreChangedView: { ...state.exploreChangedView, [sessionId]: view } }));
  };
};
