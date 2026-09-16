import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectActiveMount } from '../../store/slices/project-mounts/selectors';
import { exploreList, exploreRead } from '../explore/explore';
import { listBranchCommits } from '../worktree/worktree';
import { collectDesignProfile, type DesignProfile } from './collectDesignProfile';

type Params = Readonly<{
  state: AppState;
  sessionId: SessionId;
}>;

export const collectWireframeDesignProfile = async ({
  state,
  sessionId,
}: Params): Promise<DesignProfile | null> => {
  const mount = selectActiveMount({ state, sessionId });
  if (mount === null || mount.worktreePath.length === 0) {
    return null;
  }
  const commitSha = await listBranchCommits(mount.worktreePath)
    .then((commits) => commits[0]?.shortSha ?? null)
    .catch(() => null);
  try {
    return await collectDesignProfile({
      rootPath: mount.worktreePath,
      commitSha,
      projectName: mount.mountName,
      list: exploreList,
      read: exploreRead,
    });
  } catch {
    return null;
  }
};
