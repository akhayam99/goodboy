import { describe, expect, it } from 'vitest';
import type { PrComment } from '@goodboy/types';
import { resolveStepPlan } from './resolveStepPlan';

const commentOf = (patch: Partial<PrComment>): PrComment => ({
  id: 'review-1',
  author: 'reviewer',
  authorAvatarUrl: null,
  body: 'Why?',
  createdAt: '2026-01-01T00:00:00Z',
  url: 'https://github.com/acme/web/pull/248#discussion_r1',
  source: 'review',
  threadId: 'PRRT_1',
  ...patch,
});

describe('resolveStepPlan', () => {
  it('resolves on GitHub when the viewer can resolve the thread', () => {
    expect(
      resolveStepPlan({
        threadId: 'PRRT_1',
        comments: [commentOf({ canResolve: true })],
        shouldResolveOnGithub: true,
      }),
    ).toBe('resolve');
  });

  it('still tries when the last read did not say whether the viewer can resolve', () => {
    expect(resolveStepPlan({ threadId: 'PRRT_1', comments: [], shouldResolveOnGithub: true })).toBe(
      'resolve',
    );
  });

  it('leaves the thread open when GitHub says the viewer cannot resolve it', () => {
    expect(
      resolveStepPlan({
        threadId: 'PRRT_1',
        comments: [commentOf({ canResolve: false })],
        shouldResolveOnGithub: true,
      }),
    ).toBe('leave_open');
  });

  it('leaves the thread open when resolving on GitHub is turned off', () => {
    expect(
      resolveStepPlan({
        threadId: 'PRRT_1',
        comments: [commentOf({ canResolve: true })],
        shouldResolveOnGithub: false,
      }),
    ).toBe('leave_open');
  });
});
