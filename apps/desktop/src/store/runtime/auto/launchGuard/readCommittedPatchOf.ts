import type { ReadCommittedFilesOfParams } from '../readCommittedFiles';

export const readCommittedPatchOf = async ({
  ports,
  worktreePath,
  baseline,
  result,
}: ReadCommittedFilesOfParams): Promise<string | null> => {
  if (baseline === null || result === null) {
    return null;
  }
  if (baseline.head === result.head) {
    return '';
  }
  return ports
    .readCommittedPatch({ worktreePath, base: baseline.head, head: result.head })
    .catch((): null => null);
};
