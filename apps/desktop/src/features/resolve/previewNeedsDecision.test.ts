import { describe, expect, it } from 'vitest';
import type { ResolvePublicationPreview } from '@goodboy/types';
import { previewNeedsDecision } from './previewNeedsDecision';

const commit = (sha: string, threadIds: ReadonlyArray<string>) => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject: 'Redact the webhook payload',
  author: 'resolver',
  timestamp: 1,
  pushed: false,
  parentSha: null,
  threadIds,
});

const CLEAN: ResolvePublicationPreview = {
  publicationId: 'pub-318',
  repo: 'harborline/payments-api',
  prNumber: 318,
  branch: 'hl/fix-duplicate-credit',
  localHead: 'a41c9e2aaaa',
  remoteHead: '7d02b11bbbb',
  requiresPush: true,
  frozenAt: 1,
  commits: [commit('a41c9e2aaaa', ['t-log'])],
  unapproved: [],
  replies: [{ threadId: 't-log', body: 'Redacted.', revision: 1, closes: true }],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
};

describe('previewNeedsDecision', () => {
  it('lets a clean preview go out without a panel', () => {
    expect(previewNeedsDecision({ preview: CLEAN })).toBe(false);
  });

  it('lets a reply only preview go out without a panel', () => {
    expect(previewNeedsDecision({ preview: { ...CLEAN, requiresPush: false, commits: [] } })).toBe(
      false,
    );
  });

  it('asks when a blocker, a missing publication or a drift is there', () => {
    expect(previewNeedsDecision({ preview: { ...CLEAN, blocker: 'uncaptured_work' } })).toBe(true);
    expect(previewNeedsDecision({ preview: { ...CLEAN, publicationId: null } })).toBe(true);
    expect(
      previewNeedsDecision({
        preview: {
          ...CLEAN,
          drift: [{ kind: 'branch_moved', threadId: null, before: 'a', after: 'b' }],
        },
      }),
    ).toBe(true);
  });

  it('asks when an earlier commit that is not a fix goes along', () => {
    expect(
      previewNeedsDecision({
        preview: { ...CLEAN, earlierCommits: [commit('9e4f1c2bbbb', [])] },
      }),
    ).toBe(true);
    expect(
      previewNeedsDecision({
        preview: { ...CLEAN, commits: [commit('9e4f1c2bbbb', []), ...CLEAN.commits] },
      }),
    ).toBe(true);
  });

  it('asks when a commit is not approved', () => {
    expect(
      previewNeedsDecision({ preview: { ...CLEAN, unapproved: [commit('c0ffee1aaaa', [])] } }),
    ).toBe(true);
  });
});
