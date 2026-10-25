import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import { readAutoTreeViews } from './readAutoTreeViews';
import { sameAutoTreeViews } from './sameAutoTreeViews';
import { autoViewInitialState, type AutoTreeView } from './state';
import type { AutoViewSlice } from './types';

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

export const createAutoViewSlice = ({ set }: SliceDeps): AutoViewSlice => {
  const latest = createLatestOnly();
  return {
    ...autoViewInitialState,
    loadAutoTrees: async ({ sessionId }) => {
      await latest.run({
        key: sessionId,
        request: () => readAutoTreeViews({ db: tauriDatabase, sessionId }),
        apply: (views) =>
          set((state) => {
            const previous = state.autoTreeViews[sessionId] ?? NO_VIEWS;
            if (sameAutoTreeViews({ first: previous, second: views })) {
              return state;
            }
            return { autoTreeViews: { ...state.autoTreeViews, [sessionId]: views } };
          }),
      });
    },
  };
};
