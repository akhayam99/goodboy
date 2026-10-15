import type { SessionId } from '@goodboy/types';
import { rewriterWritableRoots } from '../history/rewriterWritableRoots';
import { selectWritableMounts } from '../project-mounts/selectors';
import {
  buildTurnWritableRoots,
  repoRootsForTurn,
  resolveGitCommonDirs,
} from './turnWritableRoots';
import type { GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  workingDir: string;
  rewriterCopyPath: string | null;
  copyPath: string | null;
}>;

export const resolveTurnWritableRoots = async ({
  get,
  sessionId,
  workingDir,
  rewriterCopyPath,
  copyPath,
}: Params) => {
  const isolatedCopyPath = rewriterCopyPath ?? copyPath;
  if (isolatedCopyPath !== null) {
    return {
      isolatedCopyPath,
      writableRoots: await rewriterWritableRoots({ copyPath: isolatedCopyPath }),
    };
  }
  const mounts = selectWritableMounts({ state: get(), sessionId });
  const gitDirs = await resolveGitCommonDirs({ repoRoots: repoRootsForTurn({ mounts }) });
  return {
    isolatedCopyPath,
    writableRoots: buildTurnWritableRoots({ mounts, workingDir, gitDirs }),
  };
};
