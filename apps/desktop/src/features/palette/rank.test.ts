import { describe, expect, it } from 'vitest';
import { EMPTY_FRECENCY, recordUse, type FrecencyState } from './frecency';
import { rankCandidates, type RankCandidate } from './rank';

const NOW = Date.parse('2026-09-28T09:00:00Z');

const used = (keys: ReadonlyArray<string>, times = 1): FrecencyState => {
  let state = EMPTY_FRECENCY;
  for (const key of keys) {
    for (let index = 0; index < times; index += 1) {
      state = recordUse({ state, key, now: NOW - index * 1000 });
    }
  }
  return state;
};

const labels = (ranked: ReadonlyArray<{ readonly item: RankCandidate }>) =>
  ranked.map((entry) => entry.item.label);

const ITEMS: ReadonlyArray<RankCandidate> = [
  { key: 'agent:scout', label: 'Scout', secondary: ['Explain the export 409'] },
  { key: 'session:payout', label: 'Speed up the payout export for large merchants' },
  { key: 'artifact:plan', label: 'Stream the payout export in pages' },
  { key: 'session:rounding', label: 'Fix the rounding drift in the settlement export' },
  { key: 'goto:inbox', label: 'Inbox' },
];

describe('rankCandidates', () => {
  it('finds both payout rows for pay export, and nothing that lacks a token', () => {
    const ranked = rankCandidates({
      items: ITEMS,
      query: 'pay export',
      frecency: EMPTY_FRECENCY,
      now: NOW,
    });

    expect([...labels(ranked)].sort()).toEqual([
      'Speed up the payout export for large merchants',
      'Stream the payout export in pages',
    ]);
  });

  it('keeps one flat ranked list: a strong session beats a weak agent', () => {
    const ranked = rankCandidates({
      items: ITEMS,
      query: 'rounding',
      frecency: EMPTY_FRECENCY,
      now: NOW,
    });

    expect(labels(ranked)[0]).toBe('Fix the rounding drift in the settlement export');
  });

  it('lets frecency order two equal matches', () => {
    const items: ReadonlyArray<RankCandidate> = [
      { key: 'a', label: 'Export ledger' },
      { key: 'b', label: 'Export ledger' },
    ];

    const ranked = rankCandidates({ items, query: 'export', frecency: used(['b']), now: NOW });

    expect(ranked.map((entry) => entry.item.key)).toEqual(['b', 'a']);
  });

  it('never lets heavy use lift a scattered match over an exact one', () => {
    const items: ReadonlyArray<RankCandidate> = [
      { key: 'scattered', label: 'Drop the inbox fixture' },
      { key: 'exact', label: 'Diff' },
    ];

    const ranked = rankCandidates({
      items,
      query: 'diff',
      frecency: used(['scattered'], 10),
      now: NOW,
    });

    expect(ranked[0]?.item.key).toBe('exact');
  });

  it('boosts a verb of the scope over the same verb elsewhere', () => {
    const items: ReadonlyArray<RankCandidate> = [
      { key: 'global', label: 'Open Review' },
      { key: 'scoped', label: 'Open Review', isScopeVerb: true },
    ];

    const ranked = rankCandidates({ items, query: 'review', frecency: EMPTY_FRECENCY, now: NOW });

    expect(ranked[0]?.item.key).toBe('scoped');
  });

  it('shows a blocked verb only when the query names it by word prefix', () => {
    const items: ReadonlyArray<RankCandidate> = [
      { key: 'archive', label: 'Archive', isBlocked: true },
    ];

    expect(rankCandidates({ items, query: '', frecency: EMPTY_FRECENCY, now: NOW })).toEqual([]);
    expect(rankCandidates({ items, query: 'ave', frecency: EMPTY_FRECENCY, now: NOW })).toEqual([]);
    expect(
      labels(rankCandidates({ items, query: 'arch', frecency: EMPTY_FRECENCY, now: NOW })),
    ).toEqual(['Archive']);
  });

  it('finds available and blocked fold actions by their label word prefix', () => {
    const items: ReadonlyArray<RankCandidate> = [
      { key: 'available', label: 'Fold down' },
      { key: 'blocked', label: 'Fold down', isBlocked: true },
    ];

    const ranked = rankCandidates({ items, query: 'fold', frecency: EMPTY_FRECENCY, now: NOW });

    expect(ranked.map((entry) => entry.item.key)).toEqual(['available', 'blocked']);
  });

  it('finds a blocked squash action by a short word prefix', () => {
    const items: ReadonlyArray<RankCandidate> = [
      { key: 'blocked', label: 'Squash down', isBlocked: true },
    ];

    expect(
      labels(rankCandidates({ items, query: 'sq', frecency: EMPTY_FRECENCY, now: NOW })),
    ).toEqual(['Squash down']);
  });

  it('orders an empty query by frecency, then by source order', () => {
    const ranked = rankCandidates({
      items: ITEMS,
      query: '',
      frecency: used(['goto:inbox']),
      now: NOW,
    });

    expect(labels(ranked).slice(0, 2)).toEqual(['Inbox', 'Scout']);
  });

  it('returns match positions on the label for highlighting', () => {
    const [first] = rankCandidates({
      items: ITEMS,
      query: 'inbox',
      frecency: EMPTY_FRECENCY,
      now: NOW,
    });

    expect(first?.positions).toEqual([0, 1, 2, 3, 4]);
  });
});
