// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { plainTitleOf } from './plainTitleOf';

describe('plainTitleOf', () => {
  it.each([
    [
      'cluster 1/2 green: typecheck/lint/knip/oxfmt/vitest ok, no commit',
      'Typecheck, lint, knip, oxfmt and vitest ok, no commit',
    ],
    [
      'commit e83d1a0 verified: vitest green, typecheck fails only from the worktree env',
      'Vitest green, typecheck fails only from the worktree env',
    ],
    [
      'pr 61 draft: oxfmt/knip/hook tests green; tsc 2 errors in untouched files',
      'Oxfmt, knip and hook tests green; tsc 2 errors in untouched files',
    ],
    ['Step 3: wrote the retry tests', 'Wrote the retry tests'],
    [
      'rebase ok, typecheck red for 1 error not ours',
      'Rebase ok, typecheck red for 1 error not ours',
    ],
    ['Found 2 doc mismatches. The second one is in the payout table.', 'Found 2 doc mismatches'],
    ['apply fix -> verify tsc -> lint -> ready for push', 'Apply fix'],
  ])('turns %j into %j', (raw, expected) => {
    expect(plainTitleOf({ text: raw })).toBe(expected);
  });

  it('keeps a label that is a real sentence start', () => {
    expect(plainTitleOf({ text: 'Run the replay test: it passes' })).toBe(
      'Run the replay test: it passes',
    );
    expect(plainTitleOf({ text: 'Reviewed 3 files: no findings' })).toBe(
      'Reviewed 3 files: no findings',
    );
  });

  it('keeps a short branch name and shortens a long path to its file', () => {
    expect(plainTitleOf({ text: 'Opened a draft from hl/surface-retry-state' })).toBe(
      'Opened a draft from hl/surface-retry-state',
    );
    expect(
      plainTitleOf({
        text: 'Edited apps/desktop/src/features/session/central/done/outcomeLineOf.ts',
      }),
    ).toBe('Edited outcomeLineOf.ts');
  });

  it('drops a parenthetical list and the backticks', () => {
    expect(plainTitleOf({ text: 'Doubled the padding (px-32, pb-64) on `PageLayout`' })).toBe(
      'Doubled the padding on PageLayout',
    );
  });

  it('caps a long title at a word and ends it with an ellipsis', () => {
    const title = plainTitleOf({
      text: 'double padding on 4 pages in the delivery list because the default page layout wraps every child twice',
    });

    expect(title).toBe(
      'Double padding on 4 pages in the delivery list because the default page layout wraps every…',
    );
    expect((title ?? '').length).toBeLessThanOrEqual(91);
  });

  it('is null for nothing, raw JSON and a label with no words after it', () => {
    expect(plainTitleOf({ text: null })).toBeNull();
    expect(plainTitleOf({ text: '  ' })).toBeNull();
    expect(plainTitleOf({ text: '{"left":[],"unknown":true}' })).toBeNull();
  });
});
