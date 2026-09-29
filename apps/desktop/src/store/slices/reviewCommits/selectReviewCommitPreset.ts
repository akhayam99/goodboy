import type { ProjectId } from '@goodboy/types';
import type { ReviewCommitPreset } from '../../../features/resolve/reviewCommits';
import type { AppState } from '../../types';

type Params = {
  readonly state: AppState;
  readonly projectId: ProjectId | null;
};

export const selectReviewCommitPreset = ({ state, projectId }: Params): ReviewCommitPreset => {
  if (projectId === null) {
    return 'keep';
  }
  const remembered = state.reviewCommitPresets[projectId];
  if (remembered !== undefined) {
    return remembered;
  }
  const project = state.projects.find((candidate) => candidate.id === projectId);
  return project?.overrides.resolveCommitStyle === 'fixup' ? 'fold' : 'keep';
};
