import { updateSessionWriteDestination } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { deriveBitbucketProjection } from '../bitbucket-pr/mountBitbucketPr';
import { deriveGithubProjection } from '../github/mountGithub';
import { deriveGitlabProjection } from '../gitlab-mr/mountGitlabMr';
import { findMountById } from './findMountById';
import { mountError } from './mountErrors';
import { selectSelectedMountId } from './selectedMountId';
import { selectWritableMounts } from './selectors';
import { writeDestinationPatch } from './writeDestinationPatch';
import type { GetFn, MountKeyInput, SetFn } from './types';

export const setSessionActiveMount = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: MountKeyInput): Promise<void> => {
    const mount = findMountById({
      mounts: selectWritableMounts({ state: get(), sessionId }),
      mountId,
    });
    if (mount === null) {
      throw mountError({
        code: 'mount-missing',
        message: `mount is not available in this session: ${mountId}`,
        mountId,
      });
    }
    const projectId = mount.projectId;
    const previousMountId = selectSelectedMountId({ state: get(), sessionId });
    const projectName =
      get().projects.find((candidate) => candidate.id === projectId)?.name ?? mount.mountName;
    const persisted = await updateSessionWriteDestination({
      db: tauriDatabase,
      sessionId,
      mountId,
    });
    if (!persisted) {
      throw mountError({
        code: 'mount-missing',
        message: `mount is no longer writable in this session: ${mountId}`,
        mountId,
      });
    }
    set((state) => {
      const patch = writeDestinationPatch({ state, sessionId, mount });
      const next = { ...state, ...patch };
      return {
        ...patch,
        ...deriveGithubProjection({ state: next, sessionId }),
        ...deriveGitlabProjection({ state: next, sessionId }),
        ...deriveBitbucketProjection({ state: next, sessionId }),
      };
    });
    if (get().githubStatus?.available === true) {
      void get()
        .refreshSessionPr(sessionId, { force: true, silent: true, retries: 1, mountId })
        .then(() => get().refreshSessionPrDetail(sessionId, { silent: true, mountId }));
    }
    if (previousMountId === mountId) {
      return;
    }
    await get().recordSessionEvent({
      sessionId,
      kind: 'write_destination_changed',
      payload: { mountId, projectId, projectName, branch: mount.branch },
    });
  };
};
