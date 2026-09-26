import type { ReleaseEntry } from './parseChangelog';

export const releaseSummary = ({ release }: { readonly release: ReleaseEntry }): string => {
  if (release.shape === 'v2') {
    return release.lead ?? '';
  }
  return (release.markdown ?? '').split('\n').find((line) => line.trim() !== '') ?? '';
};
