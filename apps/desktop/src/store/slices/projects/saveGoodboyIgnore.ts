import { updateProjectGoodboyIgnore } from '@goodboy/db';
import type { GoodboyIgnoreMode, IsoDateTime, ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { applyGoodboyIgnore } from '../../../features/worktree/goodboyIgnore';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
  readonly mode: Exclude<GoodboyIgnoreMode, 'existing'>;
};

export const saveGoodboyIgnore = (set: SetFn, get: GetFn) => {
  return async ({ projectId, mode }: Input): Promise<void> => {
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const status = await applyGoodboyIgnore({ repoPath: project.rootPath, mode });
    if (status.source === 'not-ignored' || status.source === 'unknown') {
      throw new Error('Git still does not ignore .goodboy after writing the rule.');
    }
    const checkedAt = new Date().toISOString() as IsoDateTime;
    await updateProjectGoodboyIgnore({
      db: tauriDatabase,
      projectId,
      goodboyIgnore: mode,
      goodboyIgnoreSource: status.source,
      goodboyIgnoreCheckedAt: checkedAt,
    });
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId
          ? {
              ...candidate,
              goodboyIgnore: mode,
              goodboyIgnoreSource: status.source,
              goodboyIgnoreCheckedAt: checkedAt,
            }
          : candidate,
      ),
    }));
  };
};
