import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { resolveArtifactMounts } from '../artifacts/artifactMountChoice';
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
  mountIds: ReadonlyArray<MountId>;
}>;

const WALK_FAILED_NOTE = 'the repository walk failed, so no design evidence was read';

export const oneOfManyMountsNote = ({
  mountName,
  count,
}: Readonly<{ mountName: string; count: number }>): string =>
  `the theme comes from ${mountName} alone, the first of the ${count} repositories chosen: two design systems are a question, not a merge`;

export const collectWireframeDesignProfile = async ({
  state,
  sessionId,
  mountIds,
}: Params): Promise<DesignEvidence> => {
  const mounts = resolveArtifactMounts({ state, sessionId, mountIds });
  const mount = mounts[0] ?? null;
  if (mount === null) {
    return { source: 'none' };
  }
  const extraNotes =
    mounts.length > 1
      ? [oneOfManyMountsNote({ mountName: mount.mountName, count: mounts.length })]
      : [];
  const commitSha = await listBranchCommits(mount.worktreePath)
    .then((commits) => commits[0]?.shortSha ?? null)
    .catch(() => null);
  try {
    const profile = await collectDesignProfile({
      rootPath: mount.worktreePath,
      commitSha,
      projectName: mount.mountName,
      list: exploreList,
      read: exploreRead,
    });
    return {
      source: 'mount',
      profile: { ...profile, notes: [...profile.notes, ...extraNotes] },
    };
  } catch {
    return {
      source: 'mount',
      profile: unwalkedDesignProfile({ commitSha, notes: [WALK_FAILED_NOTE, ...extraNotes] }),
    };
  }
};
