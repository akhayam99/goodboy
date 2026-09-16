import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectActiveMount } from '../../store/slices/project-mounts/selectors';
import { exploreList, exploreRead } from '../explore/explore';
import { listBranchCommits } from '../worktree/worktree';
import {
  collectDesignProfile,
  unwalkedDesignProfile,
  type DesignEvidence,
} from './collectDesignProfile';

type Params = Readonly<{
  state: AppState;
  sessionId: SessionId;
}>;

const WALK_FAILED_NOTE = 'the repository walk failed, so no design evidence was read';

export const collectWireframeDesignProfile = async ({
  state,
  sessionId,
}: Params): Promise<DesignEvidence> => {
  const mount = selectActiveMount({ state, sessionId });
  if (mount === null || mount.worktreePath.length === 0) {
    return { source: 'none' };
  }
  const commitSha = await listBranchCommits(mount.worktreePath)
    .then((commits) => commits[0]?.shortSha ?? null)
    .catch(() => null);
  try {
    return {
      source: 'mount',
      profile: await collectDesignProfile({
        rootPath: mount.worktreePath,
        commitSha,
        projectName: mount.mountName,
        list: exploreList,
        read: exploreRead,
      }),
    };
  } catch {
    return {
      source: 'mount',
      profile: unwalkedDesignProfile({ commitSha, notes: [WALK_FAILED_NOTE] }),
    };
  }
};
