import { describe, it, expect, vi } from 'vitest';
import { checkProviderBudget, checkSessionBudget, getPeriodWindow } from '../checker';
import type { Database } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';

function makeDb(overrides: Partial<Database> = {}): Database {
  return {
    select: vi.fn(),
    execute: vi.fn(),
    close: vi.fn(),
    ...overrides,
  } as unknown as Database;
}

describe('getPeriodWindow', () => {
  it('returns start/end for current UTC month', () => {
    const { start, end } = getPeriodWindow('monthly');
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    expect(start).toBe(new Date(Date.UTC(year, month, 1)).toISOString());
    expect(end).toBe(new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString());
  });
});

describe('checkProviderBudget', () => {
  it('no budget rule → Infinity remaining, pct 0, not exceeded', async () => {
    const db = makeDb({ select: vi.fn().mockResolvedValue([]) });
    const result = await checkProviderBudget(db, 'anthropic', 'monthly');
    expect(result).toEqual({ remainingUsd: Infinity, pct: 0, exceeded: false });
  });

  it('rule exists, 0% spent → remaining = cap, pct = 0', async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'r1',
          provider: 'anthropic',
          period: 'monthly',
          cap_usd: 100,
          alert_threshold_pct: 80,
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ total: 0 }]);

    const db = makeDb({ select: selectMock });
    const result = await checkProviderBudget(db, 'anthropic', 'monthly');

    expect(result.remainingUsd).toBe(100);
    expect(result.pct).toBe(0);
    expect(result.exceeded).toBe(false);
  });

  it('rule exists, 50% spent → correct remaining and pct', async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'r1',
          provider: 'anthropic',
          period: 'monthly',
          cap_usd: 100,
          alert_threshold_pct: 80,
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ total: 50 }]);

    const db = makeDb({ select: selectMock });
    const result = await checkProviderBudget(db, 'anthropic', 'monthly');

    expect(result.remainingUsd).toBe(50);
    expect(result.pct).toBe(50);
    expect(result.exceeded).toBe(false);
  });

  it('rule exists, 99% spent → not exceeded', async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'r1',
          provider: 'anthropic',
          period: 'monthly',
          cap_usd: 100,
          alert_threshold_pct: 80,
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ total: 99 }]);

    const db = makeDb({ select: selectMock });
    const result = await checkProviderBudget(db, 'anthropic', 'monthly');

    expect(result.pct).toBe(99);
    expect(result.exceeded).toBe(false);
  });

  it('rule exists, 100% spent → exceeded', async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'r1',
          provider: 'anthropic',
          period: 'monthly',
          cap_usd: 100,
          alert_threshold_pct: 80,
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ total: 100 }]);

    const db = makeDb({ select: selectMock });
    const result = await checkProviderBudget(db, 'anthropic', 'monthly');

    expect(result.pct).toBe(100);
    expect(result.exceeded).toBe(false);
  });

  it('rule exists, 101% spent → exceeded, remaining negative', async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'r1',
          provider: 'anthropic',
          period: 'monthly',
          cap_usd: 100,
          alert_threshold_pct: 80,
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ total: 101 }]);

    const db = makeDb({ select: selectMock });
    const result = await checkProviderBudget(db, 'anthropic', 'monthly');

    expect(result.remainingUsd).toBe(-1);
    expect(result.pct).toBe(101);
    expect(result.exceeded).toBe(true);
  });
});

describe('checkSessionBudget', () => {
  it('no session budget row → Infinity remaining, pct 0, not exceeded', async () => {
    const db = makeDb({ select: vi.fn().mockResolvedValue([]) });
    const result = await checkSessionBudget(db, 'sess-1' as SessionId);
    expect(result).toEqual({ remainingUsd: Infinity, pct: 0, exceeded: false });
  });

  it('cap set, under cap → correct values', async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([{ session_id: 'sess-1', soft_cap_usd: 50 }])
      .mockResolvedValueOnce([{ total: 20 }]);

    const db = makeDb({ select: selectMock });
    const result = await checkSessionBudget(db, 'sess-1' as SessionId);

    expect(result.remainingUsd).toBe(30);
    expect(result.pct).toBe(40);
    expect(result.exceeded).toBe(false);
  });

  it('cap set, over cap → exceeded', async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([{ session_id: 'sess-1', soft_cap_usd: 50 }])
      .mockResolvedValueOnce([{ total: 60 }]);

    const db = makeDb({ select: selectMock });
    const result = await checkSessionBudget(db, 'sess-1' as SessionId);

    expect(result.remainingUsd).toBe(-10);
    expect(result.exceeded).toBe(true);
  });
});
