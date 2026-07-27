import { describe, expect, it } from 'vitest';
import type { ModelMixEntry } from '@goodboy/db';
import { tierMix } from './tierMix';

type EntryParams = {
  readonly kind: 'turn' | 'summarizer';
  readonly model: string;
  readonly costUsd: number;
};

const entry = ({ kind, model, costUsd }: EntryParams): ModelMixEntry => ({
  kind,
  provider: 'anthropic',
  model,
  inputTokens: 0,
  outputTokens: 0,
  costUsd,
});

describe('tierMix', () => {
  it('splits spend across registry cost tiers and isolates upkeep', () => {
    const mix = tierMix({
      entries: [
        entry({ kind: 'turn', model: 'claude-opus-5', costUsd: 8 }),
        entry({ kind: 'turn', model: 'claude-haiku-4-5', costUsd: 1 }),
        entry({ kind: 'summarizer', model: 'claude-haiku-4-5', costUsd: 1 }),
      ],
    });

    expect(mix.totalCostUsd).toBe(10);
    expect(mix.topTierShare).toBe(80);
    expect(mix.upkeepShare).toBe(10);
    expect(mix.slices.map((slice) => slice.tier)).toEqual(['expensive', 'cheap']);
  });

  it('keeps every share at zero when nothing was spent', () => {
    const mix = tierMix({ entries: [] });

    expect(mix.slices).toEqual([]);
    expect(mix.topTierShare).toBe(0);
    expect(mix.upkeepShare).toBe(0);
  });
});
