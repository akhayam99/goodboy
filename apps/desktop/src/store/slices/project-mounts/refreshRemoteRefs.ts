import { fetchRemoteBranches } from '../../../features/worktree/worktree';

type Params = {
  readonly repoRoot: string;
};

type Entry = {
  readonly refresh: Promise<boolean>;
  readonly settledAt: number | null;
};

const REFRESH_TTL_MS = 30_000;

const entries = new Map<string, Entry>();

export const refreshRemoteRefs = ({ repoRoot }: Params): Promise<boolean> => {
  const known = entries.get(repoRoot);
  if (known !== undefined) {
    const isFresh = known.settledAt === null || Date.now() - known.settledAt < REFRESH_TTL_MS;
    if (isFresh) {
      return known.refresh;
    }
  }
  const refresh = fetchRemoteBranches(repoRoot).then(
    () => true,
    () => false,
  );
  void refresh.then(() => {
    entries.set(repoRoot, { refresh, settledAt: Date.now() });
  });
  entries.set(repoRoot, { refresh, settledAt: null });
  return refresh;
};
