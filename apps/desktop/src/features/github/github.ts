import { invoke } from '@tauri-apps/api/core';
import type { GhRunner, GhResult, GhRunOptions, PrCacheStore } from '@kay-am/core';
import type { GhTokenStatus, GithubPrCacheEntry } from '@kay-am/types';
import {
  getGithubPrCache,
  upsertGithubPrCache,
  deleteGithubPrCache,
  type Database,
} from '@kay-am/db';
import { formatError } from '../../errors';

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

export interface GithubIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

export async function fetchGithubIssue(repoSlug: string, number: number): Promise<GithubIssue> {
  const raw = await invoke<RawGhRunResult>('gh_run', {
    args: ['api', `repos/${repoSlug}/issues/${number}`],
    cwd: undefined,
  });
  if (raw.exitCode !== 0) {
    throw new Error(`gh api failed: ${raw.stderr || raw.stdout}`);
  }
  const parsed = JSON.parse(raw.stdout) as {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
  };
  return {
    number: parsed.number,
    title: parsed.title,
    body: parsed.body ?? '',
    url: parsed.html_url,
  };
}

export function parseGithubIssueUrl(input: string): { repoSlug: string; number: number } | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/issues\/(\d+)/);
  if (urlMatch) {
    return { repoSlug: urlMatch[1]!, number: parseInt(urlMatch[2]!, 10) };
  }
  const shortMatch = trimmed.match(/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/);
  if (shortMatch) {
    return { repoSlug: shortMatch[1]!, number: parseInt(shortMatch[2]!, 10) };
  }
  return null;
}

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
