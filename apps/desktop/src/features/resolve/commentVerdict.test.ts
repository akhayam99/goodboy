import { describe, expect, it } from 'vitest';
import type { ResolveVerdict } from '@goodboy/types';
import { foldedReply, verdictFromTurn, verdictReply } from './commentVerdict';

const NOW = 1_790_000_000_000;

const turn = ({ attrs }: { readonly attrs: string }): string =>
  `Looked at config.ts.\n<<comment-verdict threadId="PRRT_1" ${attrs}>>`;

describe('verdictFromTurn', () => {
  it('maps the three markers onto the three verdict kinds', () => {
    expect(
      verdictFromTurn({
        assistantText: turn({ attrs: 'verdict="fixed-here" sha="e31b9f4" evidence="folded in"' }),
        threadId: 'PRRT_1',
        now: NOW,
      }),
    ).toEqual({ kind: 'fixed_elsewhere', evidence: 'folded in', sha: 'e31b9f4', checkedAt: NOW });
    expect(
      verdictFromTurn({
        assistantText: turn({ attrs: 'verdict="not-relevant" sha="6b0e9f1" reason="deleted"' }),
        threadId: 'PRRT_1',
        now: NOW,
      })?.kind,
    ).toBe('obsolete');
    expect(
      verdictFromTurn({
        assistantText: turn({ attrs: 'verdict="still-needed" evidence="back to old text"' }),
        threadId: 'PRRT_1',
        now: NOW,
      })?.kind,
    ).toBe('refix');
  });

  it('ignores a marker for another thread and a turn without a marker', () => {
    expect(
      verdictFromTurn({
        assistantText: turn({ attrs: 'verdict="still-needed" evidence="x"' }),
        threadId: 'PRRT_2',
        now: NOW,
      }),
    ).toBeNull();
    expect(verdictFromTurn({ assistantText: 'nothing', threadId: 'PRRT_1', now: NOW })).toBeNull();
  });
});

describe('verdictReply', () => {
  const verdict = (overrides: Partial<ResolveVerdict>): ResolveVerdict => ({
    kind: 'refix',
    evidence: 'e',
    sha: null,
    checkedAt: NOW,
    ...overrides,
  });

  it('names the sha the fix was found in', () => {
    expect(
      verdictReply({ verdict: verdict({ kind: 'fixed_elsewhere', sha: 'e31b9f4abcdef' }) }),
    ).toBe('Handled in e31b9f4.');
    expect(foldedReply({ sha: '9f2c1abcdef', landedAs: 'e31b9f4abcdef' })).toBe(
      'Fixed in `9f2c1ab`, squashed into `e31b9f4`.',
    );
  });

  it('closes an obsolete comment with the removing commit when there is one', () => {
    expect(verdictReply({ verdict: verdict({ kind: 'obsolete', sha: '6b0e9f1aaaa' }) })).toBe(
      'This code was removed in 6b0e9f1, so there is nothing left to change. Closing.',
    );
    expect(verdictReply({ verdict: verdict({ kind: 'obsolete' }) })).toContain('no longer part');
  });

  it('has no reply for a fix that is still needed', () => {
    expect(verdictReply({ verdict: verdict({ kind: 'refix' }) })).toBe('');
  });
});
