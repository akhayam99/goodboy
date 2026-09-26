import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { limitsChipOf } from '@goodboy/core';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: { codexResetCredits: { availableCount: 1 } as { availableCount: number } | null },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { LimitsTooltip } from './LimitsTooltip';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const codex = (usedFraction: number): ProviderLimits => ({
  providerId: 'codex',
  plan: 'Plus',
  status: usedFraction >= 1 ? 'reached' : 'ok',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: usedFraction >= 1 ? 'reached' : 'ok',
      usedFraction,
      resetsAt: '2026-10-01T18:12:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2026-09-25T11:57:00.000Z' as IsoDateTime,
});

afterEach(cleanup);

describe('LimitsTooltip', () => {
  it('points at the free reset when codex is out', () => {
    const chip = limitsChipOf({ providerId: 'codex', limits: codex(1), nowMs: NOW });
    render(<LimitsTooltip chip={chip} nowMs={NOW} />);

    expect(screen.getByText('1 free reset available')).toBeDefined();
  });

  it('keeps quiet about resets while codex still has room', () => {
    const chip = limitsChipOf({ providerId: 'codex', limits: codex(0.4), nowMs: NOW });
    render(<LimitsTooltip chip={chip} nowMs={NOW} />);

    expect(screen.queryByText(/free reset/)).toBeNull();
  });
});
