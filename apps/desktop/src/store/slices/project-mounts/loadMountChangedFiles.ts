import {
  worktreeChangedFiles,
  type ChangedFilesSummary,
} from '../../../features/worktree/worktree';

type Cached = {
  readonly revision: string;
  readonly request: Promise<ChangedFilesSummary | null>;
};

const NO_ANSWER: ChangedFilesSummary | null = null;

const cachedByTarget = new Map<string, Cached>();

export const clearMountChangedFiles = (): void => {
  cachedByTarget.clear();
};

type LoadMountChangedFilesParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly revision: string;
};

export const loadMountChangedFiles = ({
  worktreePath,
  baseBranch,
  revision,
}: LoadMountChangedFilesParams): Promise<ChangedFilesSummary | null> => {
  const key = `${worktreePath}@${baseBranch ?? ''}`;
  const cached = cachedByTarget.get(key);
  if (cached !== undefined && cached.revision === revision) {
    return cached.request;
  }
  const request = worktreeChangedFiles({ worktreePath, baseBranch })
    .then((summary) => summary ?? null)
    .catch(() => NO_ANSWER);
  cachedByTarget.set(key, { revision, request });
  return request;
};
