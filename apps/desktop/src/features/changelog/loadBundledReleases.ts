import type { ReleaseEntry } from './parseChangelog';

export const loadBundledReleases = async (): Promise<ReadonlyArray<ReleaseEntry>> =>
  (await import('./changelogSource')).CHANGELOG_RELEASES;
