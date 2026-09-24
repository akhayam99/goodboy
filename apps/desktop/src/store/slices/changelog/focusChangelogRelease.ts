import type { GetFn, SetFn } from './types';

export type FocusChangelogReleaseParams = {
  readonly version: string | null;
};

export const focusChangelogRelease = (set: SetFn, _get: GetFn) => {
  return ({ version }: FocusChangelogReleaseParams): void => {
    set({ changelogFocusVersion: version });
  };
};
