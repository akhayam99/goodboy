import type { GithubPrCacheEntry, PullRequestState } from '@goodboy/types';
import type { GhRunner } from './gh';
import { resolvePrForBranch } from './resolver';

export interface PrCacheStore {
  get(repoSlug: string, branch: string): Promise<GithubPrCacheEntry | null>;
  upsert(entry: GithubPrCacheEntry): Promise<void>;
  invalidate(repoSlug: string, branch: string): Promise<void>;
}

export interface PrCacheDeps {
  runner: GhRunner;
  store: PrCacheStore;
  now?: () => Date;
  ttlMs?: number;
}

export const DEFAULT_PR_CACHE_TTL_MS = 60_000;

export interface GetPrInput {
  repoSlug: string;
  branch: string;
  cwd?: string;
  token?: string;
  workspaceId?: string;
  force?: boolean;
}

export async function getPrForBranch(
  deps: PrCacheDeps,
  input: GetPrInput,
): Promise<PullRequestState | null> {
  const ttl = deps.ttlMs ?? DEFAULT_PR_CACHE_TTL_MS;
  const now = deps.now ? deps.now() : new Date();
  const cached = await deps.store.get(input.repoSlug, input.branch);
  if (!input.force && cached) {
    const fetchedAt = new Date(cached.fetchedAt).getTime();
    if (Number.isFinite(fetchedAt) && now.getTime() - fetchedAt < ttl) {
      return cached.pr;
    }
  }
  const fresh = await resolvePrForBranch(deps.runner, input.repoSlug, input.branch, {
    cwd: input.cwd,
    token: input.token,
    workspaceId: input.workspaceId,
  });
  await deps.store.upsert({
    repoSlug: input.repoSlug,
    branch: input.branch,
    pr: fresh,
    fetchedAt: now.toISOString(),
  });
  return fresh;
}

export async function invalidatePrCache(
  deps: Pick<PrCacheDeps, 'store'>,
  repoSlug: string,
  branch: string,
): Promise<void> {
  await deps.store.invalidate(repoSlug, branch);
}
