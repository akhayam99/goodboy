import { readOriginAhead } from '../../../features/history/historyEngine';

type LoadParams = {
  readonly mountId: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
};

type ReadParams = {
  readonly mountId: string;
  readonly branch: string;
};

type ClearParams = {
  readonly mountId: string;
};

export type OnlineCommit = {
  readonly sha: string;
  readonly subject: string;
};

type Entry = {
  readonly branch: string;
  readonly knownRemoteSha: string | null;
  readonly commits: ReadonlyArray<OnlineCommit>;
};

const entryByMount = new Map<string, Entry>();
const requestByMount = new Map<string, number>();

export const readOnlyOnline = ({
  mountId,
  branch,
}: ReadParams): ReadonlyArray<OnlineCommit> | null => {
  const entry = entryByMount.get(mountId);
  if (entry === undefined || entry.branch !== branch) {
    return null;
  }
  return entry.commits;
};

export const readOnlineRemoteSha = ({ mountId }: ClearParams): string | null =>
  entryByMount.get(mountId)?.knownRemoteSha ?? null;

export const clearOnlyOnline = ({ mountId }: ClearParams): void => {
  requestByMount.set(mountId, (requestByMount.get(mountId) ?? 0) + 1);
  entryByMount.delete(mountId);
};

export const loadOnlyOnline = async ({
  mountId,
  worktreePath,
  branch,
  workspaceId,
  projectId,
}: LoadParams): Promise<void> => {
  const request = (requestByMount.get(mountId) ?? 0) + 1;
  requestByMount.set(mountId, request);
  const origin = await readOriginAhead({
    worktreePath,
    branch,
    since: null,
    isBringingIn: false,
    workspaceId,
    projectId,
  });
  if (requestByMount.get(mountId) !== request) {
    return;
  }
  entryByMount.set(mountId, {
    branch,
    knownRemoteSha: origin.knownRemoteSha,
    commits: origin.onlyOnline.map(({ sha, subject }) => ({ sha, subject })),
  });
};
