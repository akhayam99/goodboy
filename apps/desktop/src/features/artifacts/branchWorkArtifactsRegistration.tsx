import { ArtifactBranchWork } from './components/ArtifactList/ArtifactBranchWork';
import { useArtifactBranchGroup } from './hooks/useArtifactBranchGroup';

export const branchWorkArtifactsRegistration = {
  useWork: useArtifactBranchGroup,
  Section: ArtifactBranchWork,
};
