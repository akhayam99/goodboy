import { deleteArtifact } from './deleteArtifact';
import { loadSessionArtifacts } from './loadSessionArtifacts';
import { restoreArtifact } from './restoreArtifact';
import { restoreArtifactRevision } from './restoreArtifactRevision';
import { importWireframe, replaceWireframeSpec } from './importWireframe';
import { requestWireframeChange, settleWireframeDraft } from './requestWireframeChange';
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
import type { SliceDeps } from '../../slice-types';

export { artifactsInitialState } from './state';

export const createArtifactsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSessionArtifacts: loadSessionArtifacts(set),
    updateArtifactSource: updateArtifactSource(set),
    setArtifactStatus: setArtifactStatus(set),
    deleteArtifact: deleteArtifact(set),
    restoreArtifact: restoreArtifact(set),
    restoreArtifactRevision: restoreArtifactRevision(set),
    importWireframe: importWireframe(set, get),
    replaceWireframeSpec: replaceWireframeSpec(set),
    requestWireframeChange: requestWireframeChange(set, get),
    settleWireframeDraft: settleWireframeDraft(set),
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
