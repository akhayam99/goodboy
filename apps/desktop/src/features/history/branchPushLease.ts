import { ONLINE_COPY_CHANGED_MESSAGE } from './onlineCopyChangedMessage';
import { readOriginAhead } from './historyEngine';

type Params = {
  readonly isForce: boolean;
  readonly branch: string;
  readonly worktreePath: string;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
  readonly confirmedOnlyOnline: ReadonlyArray<string> | null;
  readonly confirmedRemoteSha: string | null;
};

export const branchPushLease = async ({
  isForce,
  branch,
  worktreePath,
  workspaceId,
  projectId,
  confirmedOnlyOnline,
  confirmedRemoteSha,
}: Params): Promise<string | null> => {
  if (!isForce) {
    return null;
  }
  const origin = await readOriginAhead({
    worktreePath,
    branch,
    since: null,
    isBringingIn: false,
    workspaceId,
    projectId,
  });
  if (origin.knownRemoteSha === null) {
    return null;
  }
  const confirmed = new Set(confirmedOnlyOnline ?? []);
  const isMoved =
    origin.knownRemoteSha !== origin.remoteSha ||
    (confirmedRemoteSha !== null && origin.knownRemoteSha !== confirmedRemoteSha) ||
    origin.onlyOnline.some((commit) => !confirmed.has(commit.sha));
  if (isMoved) {
    throw new Error(ONLINE_COPY_CHANGED_MESSAGE);
  }
  return confirmedRemoteSha ?? origin.knownRemoteSha;
};
