import { addArtifactComment } from './addArtifactComment';
import { editArtifactComment } from './editArtifactComment';
import { loadArtifactComments } from './loadArtifactComments';
import { removeArtifactComment } from './removeArtifactComment';
import { sendArtifactComments } from './sendArtifactComments';
import type { SliceDeps } from '../../slice-types';

export { artifactCommentsInitialState } from './state';

export const createArtifactCommentsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadArtifactComments: loadArtifactComments(set, get),
    addArtifactComment: addArtifactComment(set),
    editArtifactComment: editArtifactComment(set),
    removeArtifactComment: removeArtifactComment(set, get),
    sendArtifactComments: sendArtifactComments(set, get),
  };
};
