import type { ReleaseNote } from '../../../features/changelog/changelog';

export type ChangelogStatus = 'idle' | 'loading' | 'ready' | 'error';

export const SETTING_CHANGELOG_SEEN = 'changelog.lastSeenVersion';

export type ChangelogState = {
  readonly changelogReleases: ReadonlyArray<ReleaseNote>;
  readonly changelogStatus: ChangelogStatus;
  readonly changelogError: string | null;
  readonly changelogFetchedAt: string | null;
  readonly changelogSeenVersion: string | null;
};

export const initialChangelogState: ChangelogState = {
  changelogReleases: [],
  changelogStatus: 'idle',
  changelogError: null,
  changelogFetchedAt: null,
  changelogSeenVersion: null,
};
