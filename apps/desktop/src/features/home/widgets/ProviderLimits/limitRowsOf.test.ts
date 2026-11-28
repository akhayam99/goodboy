// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type ProviderId,
  type ProviderLimitWindow,
  type ProviderLimits,
} from '@goodboy/types';
import { limitRowsOf, tightestOf } from './limitRowsOf';

type WindowParams = {
  readonly usedFraction: number | null;
  readonly kind: ProviderLimitWindow['kind'];
};

const windowOf = ({ usedFraction, kind }: WindowParams) =>
  ({ kind, model: null, status: 'ok', usedFraction, resetsAt: null }) satisfies ProviderLimitWindow;

type LimitsParams = {
  readonly providerId: ProviderId;
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

const limits = ({ providerId, windows }: LimitsParams): ProviderLimits => ({
  providerId,
  plan: null,
  status: 'ok',
  windows,
  observedAt: brandId<IsoDateTime>({ value: '2026-11-27T10:00:00Z' }),
});

const ORDER: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'cursor'];

describe('limitRowsOf', () => {
  it('lists the windows of the connected providers in the provider order', () => {
    const rows = limitRowsOf({
      order: ORDER,
      connected: ['codex', 'anthropic'],
      limits: {
        anthropic: limits({
          providerId: 'anthropic',
          windows: [
            windowOf({ usedFraction: 0.2, kind: 'fiveHour' }),
            windowOf({ usedFraction: 0.5, kind: 'weekly' }),
          ],
        }),
        codex: limits({
          providerId: 'codex',
          windows: [windowOf({ usedFraction: 0.9, kind: 'weekly' })],
        }),
        cursor: limits({
          providerId: 'cursor',
          windows: [windowOf({ usedFraction: 0.99, kind: 'weekly' })],
        }),
      },
    });

    expect(rows.map((row) => [row.providerId, row.window.kind])).toEqual([
      ['anthropic', 'fiveHour'],
      ['anthropic', 'weekly'],
      ['codex', 'weekly'],
    ]);
  });

  it('draws nothing for a connected provider that reported no window yet', () => {
    expect(limitRowsOf({ order: ORDER, connected: ['anthropic'], limits: {} })).toEqual([]);
  });
});

describe('tightestOf', () => {
  it('picks the most used window, and none when there is no row', () => {
    const rows = limitRowsOf({
      order: ORDER,
      connected: ['anthropic', 'codex'],
      limits: {
        anthropic: limits({
          providerId: 'anthropic',
          windows: [windowOf({ usedFraction: 0.2, kind: 'fiveHour' })],
        }),
        codex: limits({
          providerId: 'codex',
          windows: [windowOf({ usedFraction: 0.9, kind: 'weekly' })],
        }),
      },
    });

    expect(tightestOf({ rows })?.providerId).toBe('codex');
    expect(tightestOf({ rows: [] })).toBeNull();
  });
});
