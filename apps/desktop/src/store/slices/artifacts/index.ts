import { deleteArtifact } from './deleteArtifact';
import { loadSessionArtifacts } from './loadSessionArtifacts';
import { restoreArtifact } from './restoreArtifact';
import { setArtifactStatus } from './setArtifactStatus';
import { updateArtifactSource } from './updateArtifactSource';
import type { SetFn } from './types';

export { artifactsInitialState } from './state';
export {
  selectArtifact,
  selectArtifactsByKind,
  selectPlanArtifacts,
  selectSessionArtifacts,
} from './selectors';

export const createArtifactsSlice = (set: SetFn) => {
  return {
    loadSessionArtifacts: loadSessionArtifacts(set),
    updateArtifactSource: updateArtifactSource(set),
    setArtifactStatus: setArtifactStatus(set),
    deleteArtifact: deleteArtifact(set),
    restoreArtifact: restoreArtifact(set),
  };
};
