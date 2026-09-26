import { invoke } from '@tauri-apps/api/core';
import type { GoodboyIgnoreMode } from '@goodboy/types';

export type GoodboyIgnoreStatus = {
  readonly source: 'global' | 'gitignore' | 'info-exclude' | 'not-ignored' | 'unknown';
  readonly path: string | null;
  readonly line: number | null;
};

export const checkGoodboyIgnoreStatus = async ({
  repoPath,
}: {
  readonly repoPath: string;
}): Promise<GoodboyIgnoreStatus> => {
  return invoke<GoodboyIgnoreStatus>('goodboy_ignore_status', { repoPath });
};

const APPLY_TARGET_BY_MODE: Record<Exclude<GoodboyIgnoreMode, 'existing'>, string> = {
  'this-mac': 'this-mac',
  project: 'project',
  global: 'global',
};

export const applyGoodboyIgnore = async ({
  repoPath,
  mode,
}: {
  readonly repoPath: string;
  readonly mode: Exclude<GoodboyIgnoreMode, 'existing'>;
}): Promise<GoodboyIgnoreStatus> => {
  return invoke<GoodboyIgnoreStatus>('goodboy_ignore_apply', {
    args: { repoPath, target: APPLY_TARGET_BY_MODE[mode] },
  });
};
