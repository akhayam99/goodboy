import { invoke } from '@tauri-apps/api/core';
import type { GhRunner, GhResult, GhRunOptions, PrCacheStore } from '@kay-am/core';
import type { GhTokenStatus, GithubPrCacheEntry } from '@kay-am/types';
import {
  getGithubPrCache,
  upsertGithubPrCache,
  deleteGithubPrCache,
  type Database,
} from '@kay-am/db';

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
  const raw = await invoke<RawGhStatus>('gh_status');
  return {
    available: raw.available,
    mode: raw.mode,
    version: raw.version ?? undefined,
    user: raw.user ?? undefined,
    scopes: raw.scopes,
  };
}

export async function ghSetToken(token: string): Promise<GhTokenStatus> {
  const raw = await invoke<RawGhStatus>('gh_set_token', { token });
  return {
    available: raw.available,
    mode: raw.mode,
    version: raw.version ?? undefined,
    user: raw.user ?? undefined,
    scopes: raw.scopes,
  };
}

export async function ghClearToken(): Promise<void> {
  await invoke('gh_clear_token');
}

export async function ghPrDiff(repo: string, pr: number, cwd?: string): Promise<string> {
  return invoke<string>('gh_pr_diff', { repo, pr, cwd });
}

export const tauriGhRunner: GhRunner = {
  async run(args: ReadonlyArray<string>, opts: GhRunOptions = {}): Promise<GhResult> {
    const raw = await invoke<RawGhRunResult>('gh_run', {
      args: [...args],
      cwd: opts.cwd,
    });
    return {
      stdout: raw.stdout,
      stderr: raw.stderr,
      exitCode: raw.exitCode,
    };
  },
};

export function createTauriPrCacheStore(db: Database): PrCacheStore {
  return {
    async get(repoSlug, branch) {
      const entry = await getGithubPrCache(db, repoSlug, branch);
      return entry as GithubPrCacheEntry | null;
    },
    async upsert(entry) {
      await upsertGithubPrCache(db, entry);
    },
    async invalidate(repoSlug, branch) {
      await deleteGithubPrCache(db, repoSlug, branch);
    },
  };
}
