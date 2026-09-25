import { describe, expect, it } from 'vitest';
import type { ResolveThread } from '@goodboy/types';
import { outcomePatch } from './outcomePatch';

const previous = (patch: Partial<ResolveThread>): ResolveThread =>
  ({ commitShas: null, fixupOfSha: null, replacesSha: null, ...patch }) as ResolveThread;

describe('outcomePatch commit links', () => {
  it('keeps the commit a revision replaced', () => {
    expect(
      outcomePatch({
        outcome: { kind: 'resolved', commitSha: '7c1e0aa' },
        previous: previous({ commitShas: ['4f21c8b'], fixupOfSha: '3a1f9c2' }),
      }),
    ).toMatchObject({ commitShas: ['7c1e0aa'], replacesSha: '4f21c8b', fixupOfSha: null });
  });

  it('leaves the links alone when the same commit is reported again', () => {
    const patch = outcomePatch({
      outcome: { kind: 'resolved', commitSha: '4f21c8b' },
      previous: previous({ commitShas: ['4f21c8b'], fixupOfSha: '3a1f9c2' }),
    });

    expect(patch).not.toHaveProperty('fixupOfSha');
    expect(patch).not.toHaveProperty('replacesSha');
  });

  it('replaces nothing on a first fix', () => {
    expect(
      outcomePatch({ outcome: { kind: 'resolved', commitSha: '4f21c8b' }, previous: previous({}) }),
    ).toMatchObject({ replacesSha: null, fixupOfSha: null });
  });

  it('clears the links when a revision decides not to change the code', () => {
    expect(
      outcomePatch({
        outcome: { kind: 'wontfix', reason: 'follows the sibling convention' },
        previous: previous({ commitShas: ['4f21c8b'], replacesSha: '1111111' }),
      }),
    ).toMatchObject({ commitShas: null, replacesSha: null, fixupOfSha: null });
  });
});
