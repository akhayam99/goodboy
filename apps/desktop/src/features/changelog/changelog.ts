import { invoke } from '@tauri-apps/api/core';

export type ReleaseNote = {
  readonly version: string;
  readonly publishedAt: string;
  readonly body: string;
  readonly htmlUrl: string;
};

export const fetchReleases = async (): Promise<ReadonlyArray<ReleaseNote>> => {
  return invoke<ReleaseNote[]>('releases_list');
};
