import { invoke } from '@tauri-apps/api/core';
import { detectRepoSlug, fetchPrDetail, listPrsForBranch } from '@goodboy/core';
import type { GhRunner, GhResult, GhRunOptions, PrCacheStore } from '@goodboy/core';
import type { GhTokenStatus, GithubPrCacheEntry, PrDetail, PullRequestState } from '@goodboy/types';
import {
  getGithubPrCache,
  upsertGithubPrCache,
  deleteGithubPrCache,
  type Database,
} from '@goodboy/db';
import { formatError } from '../../shared/lib/errors';

interface RawGhRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface RawGhStatus {
  available: boolean;
  mode: 'absent' | 'gh-cli' | 'pat';
  version: string | null;
  user: string | null;
  scopes: ReadonlyArray<string>;
}

export async function ghStatus(): Promise<GhTokenStatus> {
  try {
    const raw = await invoke<RawGhStatus>('gh_status');
    return {
      available: raw.available,
      mode: raw.mode,
      version: raw.version ?? undefined,
      user: raw.user ?? undefined,
      scopes: raw.scopes,
    };
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`gh status check failed: ${msg}`, { cause: err });
  }
}

export async function ghSetToken(token: string): Promise<GhTokenStatus> {
  try {
    const raw = await invoke<RawGhStatus>('gh_set_token', { token });
    return {
      available: raw.available,
      mode: raw.mode,
      version: raw.version ?? undefined,
      user: raw.user ?? undefined,
      scopes: raw.scopes,
    };
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`gh set token failed: ${msg}`, { cause: err });
  }
}

export async function ghClearToken(): Promise<void> {
  try {
    await invoke('gh_clear_token');
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`gh clear token failed: ${msg}`, { cause: err });
  }
}

export async function ghPrDiff(repo: string, pr: number, cwd?: string): Promise<string> {
  try {
    return await invoke<string>('gh_pr_diff', { repo, pr, cwd });
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`PR diff fetch for ${repo}#${pr} failed: ${msg}`, { cause: err });
  }
}

export async function ghPrsForBranch(
  cwd: string,
  branch: string,
): Promise<ReadonlyArray<PullRequestState>> {
  const slug = await detectRepoSlug(tauriGhRunner, cwd);
  if (!slug) return [];
  return listPrsForBranch(tauriGhRunner, slug, branch, { cwd });
}

export async function ghPrDetailByNumber(cwd: string, prNumber: number): Promise<PrDetail | null> {
  const slug = await detectRepoSlug(tauriGhRunner, cwd);
  if (!slug) return null;
  return fetchPrDetail(tauriGhRunner, slug, prNumber, { cwd });
}

export async function ghBaseBranches(
  cwd: string,
): Promise<{ defaultBranch: string | null; branches: ReadonlyArray<string> }> {
  const [def, list] = await Promise.all([
    tauriGhRunner.run(
      ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'],
      {
        cwd,
      },
    ),
    tauriGhRunner.run(['api', 'repos/{owner}/{repo}/branches?per_page=100', '--jq', '.[].name'], {
      cwd,
    }),
  ]);
  const defaultBranch = def.exitCode === 0 ? def.stdout.trim() || null : null;
  const branches =
    list.exitCode === 0
      ? list.stdout
          .split('\n')
          .map((b) => b.trim())
          .filter(Boolean)
      : [];
  return { defaultBranch, branches };
}

export async function ghRepoCollaborators(cwd: string): Promise<ReadonlyArray<string>> {
  const res = await tauriGhRunner.run(
    ['api', 'repos/{owner}/{repo}/collaborators?per_page=100', '--jq', '.[].login'],
    { cwd },
  );
  if (res.exitCode !== 0) return [];
  return res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function ghCommitDiff(repo: string, sha: string): Promise<string> {
  const res = await tauriGhRunner.run([
    'api',
    `repos/${repo}/commits/${sha}`,
    '-H',
    'Accept: application/vnd.github.diff',
  ]);
  if (res.exitCode !== 0) {
    throw new Error(res.stderr.trim() || `gh api commit ${repo}@${sha} exited ${res.exitCode}`);
  }
  return res.stdout;
}

export const tauriGhRunner: GhRunner = {
  async run(args: ReadonlyArray<string>, opts: GhRunOptions = {}): Promise<GhResult> {
    try {
      const raw = await invoke<RawGhRunResult>('gh_run', {
        args: [...args],
        cwd: opts.cwd,
      });
      return {
        stdout: raw.stdout,
        stderr: raw.stderr,
        exitCode: raw.exitCode,
      };
    } catch (err) {
      const msg = formatError(err);
      throw new Error(`gh run [${args.join(' ')}] failed: ${msg}`, { cause: err });
    }
  },
};

export function createTauriPrCacheStore(db: Database): PrCacheStore {
  return {
    async get(repoSlug, branch) {
      try {
        const entry = await getGithubPrCache(db, repoSlug, branch);
        return entry as GithubPrCacheEntry | null;
      } catch (err) {
        const msg = formatError(err);
        throw new Error(`PR cache get for ${repoSlug}/${branch} failed: ${msg}`, { cause: err });
      }
    },
    async upsert(entry) {
      try {
        await upsertGithubPrCache(db, entry);
      } catch (err) {
        const msg = formatError(err);
        throw new Error(`PR cache upsert for ${entry.repoSlug}/${entry.branch} failed: ${msg}`, {
          cause: err,
        });
      }
    },
    async invalidate(repoSlug, branch) {
      try {
        await deleteGithubPrCache(db, repoSlug, branch);
      } catch (err) {
        const msg = formatError(err);
        throw new Error(`PR cache invalidate for ${repoSlug}/${branch} failed: ${msg}`, {
          cause: err,
        });
      }
    },
  };
}
