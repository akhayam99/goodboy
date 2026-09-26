import { updateProjectGoodboyIgnore } from '@goodboy/db';
import type { IsoDateTime, ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { checkGoodboyIgnoreStatus } from '../../../features/worktree/goodboyIgnore';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
};

const EXPLICIT_MODES = new Set(['this-mac', 'project', 'global']);

export const checkGoodboyIgnore = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<void> => {
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined || project.kind !== 'repo') {
      return;
    }
    const status = await checkGoodboyIgnoreStatus({ repoPath: project.rootPath });
    const checkedAt = new Date().toISOString() as IsoDateTime;
    const ignored = status.source !== 'not-ignored' && status.source !== 'unknown';
    const nextMode = !ignored
      ? null
      : project.goodboyIgnore !== undefined && EXPLICIT_MODES.has(project.goodboyIgnore)
        ? project.goodboyIgnore
        : 'existing';
    const nextSource = ignored ? status.source : null;
    await updateProjectGoodboyIgnore({
      db: tauriDatabase,
      projectId,
      goodboyIgnore: nextMode,
      goodboyIgnoreSource: nextSource,
      goodboyIgnoreCheckedAt: checkedAt,
    });
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId
          ? {
              ...candidate,
              ...(nextMode === null ? { goodboyIgnore: undefined } : { goodboyIgnore: nextMode }),
              ...(nextSource === null
                ? { goodboyIgnoreSource: undefined }
                : { goodboyIgnoreSource: nextSource }),
              goodboyIgnoreCheckedAt: checkedAt,
            }
          : candidate,
      ),
    }));
  };
};
