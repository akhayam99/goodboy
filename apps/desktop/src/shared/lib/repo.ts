import { invoke } from '@tauri-apps/api/core';

export type GitRepoCheck = {
  readonly isRepo: boolean;
  readonly rootPath: string | null;
  readonly error: string | null;
};

export async function validateGitRepo(path: string): Promise<GitRepoCheck> {
  return invoke<GitRepoCheck>('validate_git_repo', { path });
}
