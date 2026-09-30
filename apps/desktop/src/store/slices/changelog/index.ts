import { focusChangelogRelease } from './focusChangelogRelease';
import { hydrateChangelogSeen } from './hydrateChangelogSeen';
import { loadChangelogDates } from './loadChangelogDates';
import { loadChangelogUpcoming } from './loadChangelogUpcoming';
import { markChangelogSeen } from './markChangelogSeen';
import { reloadChangelogDates } from './reloadChangelogDates';
import type { SliceDeps } from '../../slice-types';

export const createChangelogSlice = ({ set, get }: SliceDeps) => {
  return {
    loadChangelogDates: loadChangelogDates(set, get),
    reloadChangelogDates: reloadChangelogDates(set, get),
    hydrateChangelogSeen: hydrateChangelogSeen(set, get),
    markChangelogSeen: markChangelogSeen(set, get),
    focusChangelogRelease: focusChangelogRelease(set, get),
    loadChangelogUpcoming: loadChangelogUpcoming(set, get),
  };
};
