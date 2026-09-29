// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scoreFields, scoreText } from './score';

const marked = (text: string, positions: ReadonlyArray<number>): string =>
  [...text].map((ch, index) => (positions.includes(index) ? ch.toUpperCase() : ch)).join('');

describe('scoreText', () => {
  it('finds the payout export from two word prefixes', () => {
    const match = scoreText({
      query: 'pay export',
      text: 'Speed up the payout export for large merchants',
    });

    expect(match).not.toBeNull();
    expect(marked('Speed up the payout export for large merchants', match?.positions ?? [])).toBe(
      'Speed up the PAYout EXPORT for large merchants',
    );
    expect(match?.isWordPrefix).toBe(true);
  });

  it('checks word prefixes independently of the fuzzy match positions', () => {
    const match = scoreText({ query: 'fold', text: 'Fold down' });

    expect(match).not.toBeNull();
    expect(match?.isWordPrefix).toBe(true);
  });

  it('accepts a short prefix of a longer word', () => {
    expect(scoreText({ query: 'sq', text: 'Squash down' })?.isWordPrefix).toBe(true);
  });

  it('matches tokens in any order', () => {
    expect(scoreText({ query: 'export pay', text: 'Speed up the payout export' })).not.toBeNull();
  });

  it('misses when one token has no subsequence', () => {
    expect(scoreText({ query: 'pay zebra', text: 'Speed up the payout export' })).toBeNull();
  });

  it('marks an acronym on the word starts', () => {
    const text = 'Speed up the payout export';
    const match = scoreText({ query: 'sup', text });

    expect(marked(text, match?.positions ?? [])).toBe('Speed Up the Payout export');
  });

  it('reads a camelCase boundary as a word start', () => {
    const match = scoreText({ query: 'rt', text: 'openReviewTarget' });

    expect(match?.positions).toEqual([4, 10]);
  });

  it('ranks a word start above the same letters inside a word', () => {
    const start = scoreText({ query: 'port', text: 'Port the ledger' });
    const inside = scoreText({ query: 'port', text: 'Export the ledger' });

    expect(start!.score).toBeGreaterThan(inside!.score);
  });

  it('ranks a run above the same letters scattered', () => {
    const run = scoreText({ query: 'diff', text: 'Open Diff' });
    const scattered = scoreText({ query: 'diff', text: 'Draft is fine, flag' });

    expect(run!.score).toBeGreaterThan(scattered!.score);
  });

  it('ranks the exact label above a longer one with the same prefix', () => {
    const exact = scoreText({ query: 'inbox', text: 'Inbox' });
    const longer = scoreText({ query: 'inbox', text: 'Inbox filters' });

    expect(exact!.score).toBeGreaterThan(longer!.score);
  });

  it('flags a scattered match as not a word prefix', () => {
    expect(scoreText({ query: 'ave', text: 'Archive' })?.isWordPrefix).toBe(false);
    expect(scoreText({ query: 'arch', text: 'Archive' })?.isWordPrefix).toBe(true);
  });

  it('ignores case and extra spaces', () => {
    expect(scoreText({ query: '  PAY   Export ', text: 'the payout export' })).not.toBeNull();
  });

  it('matches everything on an empty query with no positions', () => {
    expect(scoreText({ query: '', text: 'Anything' })).toEqual({
      score: 0,
      positions: [],
      isWordPrefix: true,
    });
  });
});

describe('scoreFields', () => {
  it('lets one token hit the label and another the secondary field', () => {
    const match = scoreFields({
      query: 'northwind payout',
      label: 'Speed up the payout export',
      secondary: ['Northwind'],
    });

    expect(match).not.toBeNull();
    expect(match?.isOnLabel).toBe(true);
  });

  it('weighs a secondary hit below the same hit on the label', () => {
    const onLabel = scoreFields({ query: 'ledger', label: 'Ledger drift', secondary: [] });
    const onSecondary = scoreFields({
      query: 'ledger',
      label: 'Fix the drift',
      secondary: ['ledger'],
    });

    expect(onLabel!.score).toBeGreaterThan(onSecondary!.score);
    expect(onSecondary?.isOnLabel).toBe(false);
    expect(onSecondary?.positions).toEqual([]);
  });
});
