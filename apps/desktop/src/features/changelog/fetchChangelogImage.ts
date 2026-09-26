import { invoke } from '@tauri-apps/api/core';

export type FetchChangelogImageParams = {
  readonly version: string;
  readonly file: string;
};

export const fetchChangelogImage = ({
  version,
  file,
}: FetchChangelogImageParams): Promise<string> =>
  invoke<string>('changelog_image', { version, file });
