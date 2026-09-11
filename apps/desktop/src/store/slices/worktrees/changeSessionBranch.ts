import type { MountId, SessionId } from '@goodboy/types';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { switchMount } from '../project-mounts/switchMount';
import { selectMountById } from '../project-mounts/selectors';
import type { GetFn, SetFn } from './types';

type Args = {
  mountId: MountId;
  branch: string;
  createNew: boolean;
};

export const changeSessionBranch = (set: SetFn, get: GetFn) => {
  const runSwitch = switchMount(set, get);
  return async (sessionId: SessionId, { mountId, branch, createNew }: Args): Promise<void> => {
    const mount = selectMountById({ state: get(), sessionId, mountId });
    if (mount === null) {
      throw new Error(`no branch mount found for ${mountId}`);
    }
    if (isBranchlessSession({ branch: mount.branch })) {
      return;
    }
    const target = branch.trim();
    if (target === '') {
      throw new Error('branch name cannot be empty');
    }
    await runSwitch({ sessionId, mountId, branch: target, createNew });
  };
};
