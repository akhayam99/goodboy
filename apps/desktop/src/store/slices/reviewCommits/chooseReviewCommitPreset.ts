import { setSetting, updateProjectResolveCommitStyle } from '@goodboy/db';
import type { ProjectId, ResolveCommitStyle } from '@goodboy/types';
import type { ReviewCommitPreset } from '../../../features/resolve/reviewCommits';
import { tauriDatabase } from '../../../shared/lib/db';
import { reviewCommitPresetKey } from './state';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
  readonly preset: ReviewCommitPreset;
};

export const commitStyleOfPreset = ({
  preset,
}: {
  readonly preset: ReviewCommitPreset;
}): ResolveCommitStyle => (preset === 'fold' ? 'fixup' : 'new');

export const chooseReviewCommitPreset = (set: SetFn, get: GetFn) => {
  return async ({ projectId, preset }: Input): Promise<void> => {
    const commitStyle = commitStyleOfPreset({ preset });
    const isKnown = get().projects.some((candidate) => candidate.id === projectId);
    set((state) => ({
      reviewCommitPresets: { ...state.reviewCommitPresets, [projectId]: preset },
      projects: state.projects.map((candidate) =>
        candidate.id === projectId
          ? { ...candidate, overrides: { ...candidate.overrides, resolveCommitStyle: commitStyle } }
          : candidate,
      ),
    }));
    if (!isKnown) {
      return;
    }
    await setSetting(tauriDatabase, reviewCommitPresetKey({ projectId }), preset);
    await updateProjectResolveCommitStyle({ db: tauriDatabase, projectId, commitStyle });
  };
};
