import { describe, expect, it } from 'vitest';
import type { MountId } from '@goodboy/types';
import { checksAnalyzeSeed } from '../../../app/components/MockScene/scenes/u24/checksAnalyzeSeed';
import { selectCheckMount } from './selectCheckMount';

const OTHER_MOUNT: MountId = JSON.parse(JSON.stringify('mount-other'));

describe('selectCheckMount', () => {
  it('finds the mount that holds the check, not the first mount', () => {
    const seed = checksAnalyzeSeed({ phase: 'proposal' });
    const state = {
      mountGithub: {
        [OTHER_MOUNT]: {
          mountId: OTHER_MOUNT,
          prs: [{ url: 'https://github.com/harborline/ledger-core/pull/1' }],
          detail: {
            checks: [{ detailsUrl: 'https://github.com/harborline/ledger-core/actions/runs/1' }],
          },
        },
        [seed.repo.mountId]: {
          mountId: seed.repo.mountId,
          prs: [{ url: seed.pullRequest.url }],
          detail: { checks: [{ detailsUrl: seed.check.detailsUrl }] },
        },
      },
    };
    expect(selectCheckMount({ state, url: seed.check.detailsUrl ?? '' })).toBe(seed.repo.mountId);
    expect(selectCheckMount({ state, url: seed.pullRequest.url })).toBe(seed.repo.mountId);
  });
  it('returns null when no mount holds the url', () => {
    expect(selectCheckMount({ state: { mountGithub: {} }, url: 'https://x.test/a' })).toBeNull();
  });
});
