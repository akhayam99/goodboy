import type { ReleaseNote } from '../../../features/changelog/changelog';

export type ChangelogStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ChangelogState = {
  readonly changelogReleases: ReadonlyArray<ReleaseNote>;
  readonly changelogStatus: ChangelogStatus;
  readonly changelogError: string | null;
  readonly changelogFetchedAt: string | null;
};

export const initialChangelogState: ChangelogState = {
  changelogReleases: [],
  changelogStatus: 'idle',
  changelogError: null,
  changelogFetchedAt: null,
};
