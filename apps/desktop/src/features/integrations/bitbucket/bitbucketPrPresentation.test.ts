import { describe, expect, it } from 'vitest';
import type { BitbucketPullRequestState } from './client';
import { BITBUCKET_PR_PRESENTATION, describeBitbucketPrState } from './bitbucketPrPresentation';
import { PULL_REQUEST_PRESENTATION } from '../../../shared/pullRequestPresentation';
import { stateDescription } from '../../../shared/utils/statePresentation';

const STATES = Object.keys(BITBUCKET_PR_PRESENTATION) as ReadonlyArray<BitbucketPullRequestState>;

describe('describeBitbucketPrState', () => {
  it('reads every shared state exactly as the rest of the app reads it', () => {
    expect(describeBitbucketPrState({ state: 'OPEN' })).toBe(PULL_REQUEST_PRESENTATION.open);
    expect(describeBitbucketPrState({ state: 'MERGED' })).toBe(PULL_REQUEST_PRESENTATION.merged);
    expect(describeBitbucketPrState({ state: 'DECLINED' })).toBe(PULL_REQUEST_PRESENTATION.closed);
  });

  it('keeps a merged pull request apart from a declined one', () => {
    const merged = describeBitbucketPrState({ state: 'MERGED' });
    const declined = describeBitbucketPrState({ state: 'DECLINED' });

    expect(merged.tone).toBe('merged');
    expect(declined.tone).toBe('danger');
    expect(merged.icon).not.toBe(declined.icon);
  });

  it('maps superseded on its own rather than folding it into a neighbour', () => {
    const superseded = describeBitbucketPrState({ state: 'SUPERSEDED' });

    expect(superseded.label).toBe('Superseded');
    expect(superseded.reason).toBe('replaced by a newer pull request');
    expect(Object.values(PULL_REQUEST_PRESENTATION)).not.toContain(superseded);
    expect(stateDescription({ presentation: superseded, subject: 'PR #4' })).toBe(
      'PR #4 superseded, replaced by a newer pull request',
    );
  });

  it('gives every bitbucket state a label and a reason', () => {
    for (const state of STATES) {
      const presentation = describeBitbucketPrState({ state });
      expect(presentation.label.length, state).toBeGreaterThan(0);
      expect(presentation.reason.length, state).toBeGreaterThan(0);
    }
  });
});
