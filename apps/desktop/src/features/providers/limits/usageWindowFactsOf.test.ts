// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderLimitWindow } from '@goodboy/types';
import { usageWindowFactsOf } from './usageWindowFactsOf';

const NOW = Date.parse('2026-11-27T10:00:00Z');

type PatchParams = {
  readonly patch: Partial<ProviderLimitWindow>;
};

const windowWith = ({ patch }: PatchParams): ProviderLimitWindow => ({
  kind: 'fiveHour',
  model: null,
  status: 'ok',
  usedFraction: 0.4,
  resetsAt: brandId<IsoDateTime>({ value: '2026-11-27T12:30:00Z' }),
  ...patch,
});

describe('usageWindowFactsOf', () => {
  it('reads one label, one tone, one percent and one reset line for a window', () => {
    const facts = usageWindowFactsOf({
      window: windowWith({ patch: {} }),
      siblings: [],
      nowMs: NOW,
    });

    expect(facts.label).toBe('5-hour window');
    expect(facts.tone).toBe('neutral');
    expect(facts.percentText).toBe('40%');
    expect(facts.resetText).toMatch(/^Resets /);
  });

  it('warns from the shared fraction and says Out until when the window is used up', () => {
    const warn = usageWindowFactsOf({
      window: windowWith({ patch: { usedFraction: 0.9, status: 'warning' } }),
      siblings: [],
      nowMs: NOW,
    });
    const out = usageWindowFactsOf({
      window: windowWith({ patch: { usedFraction: 1, status: 'reached' } }),
      siblings: [],
      nowMs: NOW,
    });

    expect(warn.tone).toBe('warning');
    expect(out.tone).toBe('danger');
    expect(out.resetText).toMatch(/^Out until /);
  });

  it('draws no percent and no reset when the provider reports neither', () => {
    const facts = usageWindowFactsOf({
      window: windowWith({ patch: { usedFraction: null, resetsAt: null } }),
      siblings: [],
      nowMs: NOW,
    });

    expect(facts.percentText).toBeNull();
    expect(facts.resetText).toBe('');
  });
});
