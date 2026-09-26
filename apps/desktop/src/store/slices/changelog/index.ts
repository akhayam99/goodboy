import { focusChangelogRelease } from './focusChangelogRelease';
import { hydrateChangelogSeen } from './hydrateChangelogSeen';
import { loadChangelogDates } from './loadChangelogDates';
import { markChangelogSeen } from './markChangelogSeen';
import { reloadChangelogDates } from './reloadChangelogDates';
import type { GetFn, SetFn } from './types';

export const createChangelogSlice = (set: SetFn, get: GetFn) => {
  return {
    loadChangelogDates: loadChangelogDates(set, get),
    reloadChangelogDates: reloadChangelogDates(set, get),
    hydrateChangelogSeen: hydrateChangelogSeen(set, get),
    markChangelogSeen: markChangelogSeen(set, get),
    focusChangelogRelease: focusChangelogRelease(set, get),
  };
};
