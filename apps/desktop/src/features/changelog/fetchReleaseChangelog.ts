import { invoke } from '@tauri-apps/api/core';

export const fetchReleaseChangelog = ({ version }: { readonly version: string }): Promise<string> =>
  invoke<string>('release_changelog', { version });
