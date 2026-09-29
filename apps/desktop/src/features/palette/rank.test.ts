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

describe('rankCandidates performance', () => {
  const WORDS = [
    'payout',
    'export',
    'ledger',
    'settlement',
    'webhook',
    'retry',
    'merchant',
    'rounding',
    'drift',
    'tenant',
    'limits',
    'signing',
    'secret',
    'rotate',
    'stream',
    'pages',
    'harbor',
    'relay',
  ];
  const items: ReadonlyArray<RankCandidate> = Array.from({ length: 5_000 }, (_, index) => ({
    key: `session:${index}`,
    label: Array.from(
      { length: 6 },
      (__, word) => WORDS[(index * 7 + word * 5) % WORDS.length],
    ).join(' '),
    secondary: [index % 2 === 0 ? 'Harborline' : 'Northwind', `ledger-core ${index}`],
  }));
  const frecency = used(
    items.slice(0, 150).map((item) => item.key),
    3,
  );

  const SAMPLE_COUNT = 7;

  type ReferenceMatchParams = {
    readonly token: string;
    readonly text: string;
  };

  const referenceMatch = ({ token, text }: ReferenceMatchParams): number => {
    const lower = text.toLowerCase();
    const tokenLength = token.length;
    const textLength = lower.length;
    if (tokenLength === 0 || tokenLength > textLength) {
      return 0;
    }
    const scores = new Float64Array(tokenLength * textLength);
    for (let column = 0; column < textLength; column += 1) {
      scores[column] = lower[column] === token[0] ? 1 : 0;
    }
    for (let row = 1; row < tokenLength; row += 1) {
      for (let column = 1; column < textLength; column += 1) {
        const diagonal = scores[(row - 1) * textLength + (column - 1)] ?? 0;
        const left = scores[row * textLength + (column - 1)] ?? 0;
        scores[row * textLength + column] =
          lower[column] === token[row] ? diagonal + 1 : Math.max(diagonal, left);
      }
    }
    return scores[tokenLength * textLength - 1] ?? 0;
  };

  type ReferenceScoreParams = {
    readonly items: ReadonlyArray<RankCandidate>;
    readonly query: string;
  };

  const referenceScore = ({ items: candidates, query }: ReferenceScoreParams): number => {
    const tokens = query
      .toLowerCase()
      .split(' ')
      .filter((token) => token.length > 0);
    const matches: Array<{ readonly key: string; readonly score: number }> = [];
    candidates.forEach((item) => {
      const label = item.label.toLowerCase();
      const secondary = (item.secondary ?? []).map((text) => text.toLowerCase());
      if (tokens.length === 0) {
        matches.push({ key: item.key, score: 0 });
        return;
      }
      let score = 0;
      let matchedEvery = true;
      tokens.forEach((token) => {
        const onLabel = referenceMatch({ token, text: label });
        const onSecondary = secondary.reduce(
          (best, text) => Math.max(best, referenceMatch({ token, text })),
          0,
        );
        if (onLabel === 0 && onSecondary === 0) {
          matchedEvery = false;
          return;
        }
        score += Math.max(onLabel, onSecondary);
      });
      if (matchedEvery) {
        matches.push({ key: item.key, score });
      }
    });
    matches.sort((a, b) => b.score - a.score);
    return matches.length;
  };

  type MinParams = {
    readonly values: ReadonlyArray<number>;
  };

  const min = ({ values }: MinParams): number => values.reduce((a, b) => Math.min(a, b));

  const PERFORMANCE_CASES: ReadonlyArray<{ readonly query: string; readonly ratioBudget: number }> =
    [
      { query: 'pay export', ratioBudget: 1.6 },
      { query: 'p', ratioBudget: 4.6 },
      { query: 'set drift nort', ratioBudget: 2.3 },
      { query: 'zzqx', ratioBudget: 0.75 },
      { query: 'retry webhook merchant', ratioBudget: 1.75 },
    ];

  it.each(PERFORMANCE_CASES)(
    'ranks 5k items for $query within a budget relative to a same-process reference scorer',
    ({ query, ratioBudget }) => {
      rankCandidates({ items, query, frecency, now: NOW });
      referenceScore({ items, query });

      const baseMs = min({
        values: Array.from({ length: SAMPLE_COUNT }, () => {
          const started = performance.now();
          referenceScore({ items, query });
          return performance.now() - started;
        }),
      });
      const rankSamples = Array.from({ length: SAMPLE_COUNT }, () => {
        const started = performance.now();
        const ranked = rankCandidates({ items, query, frecency, now: NOW });
        return { ms: performance.now() - started, length: ranked.length };
      });
      const rankMs = min({ values: rankSamples.map((sample) => sample.ms) });
      const ratio = rankMs / baseMs;

      expect(rankSamples[0]?.length).toBeLessThanOrEqual(60);
      expect(ratio, `rank ${rankMs}ms base ${baseMs}ms`).toBeLessThan(ratioBudget);
    },
  );
});
