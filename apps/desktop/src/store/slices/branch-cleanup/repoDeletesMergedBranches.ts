import { ghRepoDeletesMergedBranches } from '../../../features/integrations/github/github';

const DAY_MS = 24 * 60 * 60 * 1000;

type Entry = {
  readonly value: boolean | null;
  readonly checkedAt: number;
};

const cache = new Map<string, Entry>();

type Params = {
  readonly repoRoot: string;
  readonly workspaceId: string;
  readonly now?: number;
};

export const repoDeletesMergedBranches = async ({
  repoRoot,
  workspaceId,
  now = Date.now(),
}: Params): Promise<boolean | null> => {
  const cached = cache.get(repoRoot);
  if (cached !== undefined && now - cached.checkedAt < DAY_MS) {
    return cached.value;
  }
  const value = await ghRepoDeletesMergedBranches({ cwd: repoRoot, workspaceId }).catch(() => null);
  cache.set(repoRoot, { value, checkedAt: now });
  return value;
};

export const forgetRepoAutoDeleteCache = (): void => {
  cache.clear();
};
