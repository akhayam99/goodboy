import { createNewProject } from './createNewProject';
import { ensureFirstLapSession } from './ensureFirstLapSession';
import { hydrateBootstrapPhases } from './hydrateBootstrapPhases';
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
});
