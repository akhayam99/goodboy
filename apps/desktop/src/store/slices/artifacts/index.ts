import { deleteArtifact } from './deleteArtifact';
import { loadSessionArtifacts } from './loadSessionArtifacts';
import { restoreArtifact } from './restoreArtifact';
import { setArtifactStatus } from './setArtifactStatus';
import { spawnReportAgent } from './spawnReportAgent';
import { spawnWireframeAgent } from './spawnWireframeAgent';
import { updateArtifactSource } from './updateArtifactSource';
import {
  expireArtifactScouts,
  joinArtifactScouts,
  recoverArtifactScouts,
  startReportScouts,
  startWireframeScouts,
  stopArtifactGeneration,
} from './artifactScoutRun';
import type { GetFn, SetFn } from './types';

export { artifactsInitialState } from './state';
export {
  selectArtifact,
  selectArtifactsByKind,
  selectPlanArtifacts,
  selectSessionArtifacts,
} from './selectors';

export const createArtifactsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadSessionArtifacts: loadSessionArtifacts(set),
    updateArtifactSource: updateArtifactSource(set),
    setArtifactStatus: setArtifactStatus(set),
    deleteArtifact: deleteArtifact(set),
    restoreArtifact: restoreArtifact(set),
    spawnReportAgent: spawnReportAgent(get),
    spawnWireframeAgent: spawnWireframeAgent(get),
    startWireframeScouts: startWireframeScouts(set, get),
    startReportScouts: startReportScouts(set, get),
    joinArtifactScouts: joinArtifactScouts(set, get),
    expireArtifactScouts: expireArtifactScouts(set, get),
    recoverArtifactScouts: recoverArtifactScouts(set, get),
    stopArtifactGeneration: stopArtifactGeneration(set, get),
  };
};
