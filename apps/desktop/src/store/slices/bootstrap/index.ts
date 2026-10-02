import { createNewProject } from './createNewProject';
import { ensureFirstLapSession } from './ensureFirstLapSession';
import { hydrateBootstrapPhases } from './hydrateBootstrapPhases';
import { moveToBootstrap, resumeBootstrapMove } from './moveToBootstrap';
import { probeProjectRemote } from './probeProjectRemote';
import { publishFirstLap } from './publishFirstLap';
import { setBootstrapPhase } from './setBootstrapPhase';
import { bootstrapInitialState } from './state';
import type { BootstrapSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createBootstrapSlice = ({ set, get }: SliceDeps): BootstrapSlice => ({
  ...bootstrapInitialState,
  hydrateBootstrapPhases: hydrateBootstrapPhases(set, get),
  setBootstrapPhase: setBootstrapPhase(set, get),
  createNewProject: createNewProject(set, get),
  ensureFirstLapSession: ensureFirstLapSession(set, get),
  probeProjectRemote: probeProjectRemote(set, get),
  publishFirstLap: publishFirstLap(set, get),
  moveToBootstrap: moveToBootstrap(set, get),
  resumeBootstrapMove: resumeBootstrapMove(set, get),
  dismissBootstrapReport: ({ projectId }) =>
    set((state) => {
      const { [projectId]: _removed, ...rest } = state.bootstrapMoveReport;
      return { bootstrapMoveReport: rest };
    }),
});
