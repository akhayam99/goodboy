import type { SliceDeps } from '../../slice-types';
import type { ActionRunKeyParams } from './types';
import { withoutRun } from './withoutRun';

export const PENDING_RESET_MS = 600_000;

export const attachActionRunSurface = ({ set, get }: SliceDeps) => {
  return ({ key }: ActionRunKeyParams): void => {
    const state = get();
    const count = state.actionRunSurfaces[key] ?? 0;
    const run = state.actionRuns[key];
    const isStuck =
      count === 0 &&
      run !== undefined &&
      run.phase === 'pending' &&
      Date.now() - run.startedAt > PENDING_RESET_MS;
    set((current) => ({
      actionRunSurfaces: { ...current.actionRunSurfaces, [key]: count + 1 },
      actionRuns: isStuck ? withoutRun({ runs: current.actionRuns, key }) : current.actionRuns,
    }));
  };
};
