import { getSetting } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import {
  REVIEW_COMMIT_PRESETS,
  type ReviewCommitPreset,
} from '../../../features/resolve/reviewCommits';
import { tauriDatabase } from '../../../shared/lib/db';
import { reviewCommitPresetKey } from './state';
import type { GetFn, SetFn } from './types';

const isPreset = (value: string | null): value is ReviewCommitPreset =>
  REVIEW_COMMIT_PRESETS.some((preset) => preset === value);

export const loadReviewCommitPreset = (set: SetFn, _get: GetFn) => {
  return async ({ projectId }: { readonly projectId: ProjectId }): Promise<void> => {
    const stored = await getSetting(tauriDatabase, reviewCommitPresetKey({ projectId })).catch(
      () => null,
    );
    if (!isPreset(stored)) {
      return;
    }
    set((state) => ({
      reviewCommitPresets: { ...state.reviewCommitPresets, [projectId]: stored },
    }));
  };
};
