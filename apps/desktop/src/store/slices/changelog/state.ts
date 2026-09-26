import { CHANGELOG_RELEASES } from '../../../features/changelog/changelogSource';
import type { ReleaseEntry } from '../../../features/changelog/parseChangelog';

export type ChangelogDatesStatus = 'idle' | 'loading' | 'ready' | 'error';

export const SETTING_CHANGELOG_SEEN = 'changelog.lastSeenVersion';

export type ChangelogState = {
  readonly changelogReleases: ReadonlyArray<ReleaseEntry>;
  readonly changelogDates: Readonly<Record<string, string>>;
  readonly changelogDatesStatus: ChangelogDatesStatus;
  readonly changelogDatesFetchedAt: string | null;
  readonly changelogSeenVersion: string | null;
  readonly changelogSeenHydrated: boolean;
  readonly changelogFocusVersion: string | null;
};

export const initialChangelogState: ChangelogState = {
  changelogReleases: CHANGELOG_RELEASES,
  changelogDates: {},
  changelogDatesStatus: 'idle',
  changelogDatesFetchedAt: null,
  changelogSeenVersion: null,
  changelogSeenHydrated: false,
  changelogFocusVersion: null,
};
