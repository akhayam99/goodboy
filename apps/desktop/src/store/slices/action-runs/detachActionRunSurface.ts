import type { SliceDeps } from '../../slice-types';
import type { ActionRunKeyParams } from './types';
import { withoutRun } from './withoutRun';

export const detachActionRunSurface = ({ set, get }: SliceDeps) => {
  return ({ key }: ActionRunKeyParams): void => {
    const count = get().actionRunSurfaces[key] ?? 0;
    if (count === 0) {
      return;
    }
    if (count > 1) {
      set((state) => ({ actionRunSurfaces: { ...state.actionRunSurfaces, [key]: count - 1 } }));
      return;
    }
    set((state) => ({
      actionRunSurfaces: Object.fromEntries(
        Object.entries(state.actionRunSurfaces).filter(([surfaceKey]) => surfaceKey !== key),
      ),
      actionRuns:
        state.actionRuns[key]?.phase === 'pending'
          ? state.actionRuns
          : withoutRun({ runs: state.actionRuns, key }),
    }));
  };
};
