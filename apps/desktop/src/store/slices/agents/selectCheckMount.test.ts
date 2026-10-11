import { describe, expect, it } from 'vitest';
import type { MountId } from '@goodboy/types';
import { selectCheckMount } from './selectCheckMount';

const OTHER_MOUNT: MountId = JSON.parse(JSON.stringify('mount-other'));
const CHECK_MOUNT: MountId = JSON.parse(JSON.stringify('mount-checks'));
const PR_URL = 'https://github.com/harborline/payments-api/pull/248';
const CHECK_URL = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';

const state = {
  mountGithub: {
    [OTHER_MOUNT]: {
      mountId: OTHER_MOUNT,
      prs: [{ url: 'https://github.com/harborline/ledger-core/pull/1' }],
      detail: {
        checks: [{ detailsUrl: 'https://github.com/harborline/ledger-core/actions/runs/1' }],
      },
    },
    [CHECK_MOUNT]: {
      mountId: CHECK_MOUNT,
      prs: [{ url: PR_URL }],
      detail: { checks: [{ detailsUrl: CHECK_URL }] },
    },
  },
};

describe('selectCheckMount', () => {
  it('finds the mount that holds the check, not the first mount', () => {
    expect(selectCheckMount({ state, url: CHECK_URL })).toBe(CHECK_MOUNT);
    expect(selectCheckMount({ state, url: PR_URL })).toBe(CHECK_MOUNT);
  });
  it('returns null when no mount holds the url', () => {
    expect(selectCheckMount({ state, url: 'https://x.test/a' })).toBeNull();
  });
});
