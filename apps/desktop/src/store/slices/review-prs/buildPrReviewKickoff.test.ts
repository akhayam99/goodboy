import { describe, expect, it } from 'vitest';
import type { ReviewablePr } from '@goodboy/types';
import { buildPrReviewKickoff } from './buildPrReviewKickoff';

const buildPr = (overrides: Partial<ReviewablePr> = {}): ReviewablePr => {
  return {
    id: 'github:7',
    provider: 'github',
    repo: 'org/repo',
    number: 7,
    title: 'Fix parser',
    url: 'https://github.com/org/repo/pull/7',
    author: 'alice',
    authorAvatarUrl: null,
    mine: false,
    reviewRequested: false,
    state: 'open',
    baseBranch: 'main',
    headBranch: 'alice/fix-parser',
    isDraft: false,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
};

describe('buildPrReviewKickoff', () => {
  it('embeds PR metadata, the review contract, and the fenced diff', () => {
    const out = buildPrReviewKickoff({ pr: buildPr(), diff: 'diff --git a/x b/x\n+x\n' });
    expect(out).toContain('- number: #7');
    expect(out).toContain('- author: alice');
    expect(out).toContain('- url: https://github.com/org/repo/pull/7');
    expect(out).toContain('- branches: alice/fix-parser -> main');
    expect(out).toContain('read-only review session');
    expect(out).toContain('```diff\ndiff --git a/x b/x\n+x\n\n```');
  });

  it('instructs a structured overview first, then waiting for questions', () => {
    const out = buildPrReviewKickoff({ pr: buildPr(), diff: '+x' });
    expect(out).toContain('files touched, intent, risk areas');
    expect(out).toContain('then wait for questions');
  });

  it('uses the gitlab bang identifier', () => {
    const out = buildPrReviewKickoff({
      pr: buildPr({ provider: 'gitlab', number: 12 }),
      diff: '+x',
    });
    expect(out).toContain('- number: !12');
  });

  it('truncates an oversized diff and notes the full size', () => {
    const out = buildPrReviewKickoff({ pr: buildPr(), diff: 'a'.repeat(60005) });
    expect(out).toContain('[diff truncated at 60000 characters, full diff is 60005 characters]');
    expect(out).not.toContain('a'.repeat(60001));
  });

  it('falls back to a placeholder when the diff is missing', () => {
    const out = buildPrReviewKickoff({ pr: buildPr(), diff: null });
    expect(out).toContain('The diff could not be fetched');
    expect(out).not.toContain('```diff');
  });
});
