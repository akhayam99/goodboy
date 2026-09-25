import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listProviderLimits, upsertProviderLimits } from './provider-limits';

const CODEX_OUT: ProviderLimits = {
  providerId: 'codex',
  plan: 'Plus',
  status: 'reached',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: 0,
      resetsAt: '2026-09-25T15:59:15.000Z' as IsoDateTime,
    },
    {
      kind: 'weekly',
      model: null,
      status: 'reached',
      usedFraction: 1,
      resetsAt: '2026-09-26T21:38:48.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2026-09-25T10:59:20.919Z' as IsoDateTime,
};

describe('provider limits queries', () => {
  it('keeps the last observation per provider across a restart', async () => {
    const db = await makeMigratedTestDatabase();
    await upsertProviderLimits({ db, limits: CODEX_OUT, nowMs: 1 });

    expect(await listProviderLimits({ db })).toEqual([CODEX_OUT]);
  });

  it('replaces an older observation and ignores a stale one', async () => {
    const db = await makeMigratedTestDatabase();
    await upsertProviderLimits({ db, limits: CODEX_OUT, nowMs: 1 });
    const newer: ProviderLimits = {
      ...CODEX_OUT,
      status: 'ok',
      windows: [],
      observedAt: '2026-09-27T08:00:00.000Z' as IsoDateTime,
    };
    await upsertProviderLimits({ db, limits: newer, nowMs: 2 });
    await upsertProviderLimits({ db, limits: CODEX_OUT, nowMs: 3 });

    expect(await listProviderLimits({ db })).toEqual([newer]);
  });

  it('reads a row with broken windows as a provider without windows', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO provider_limits (provider_id, plan, status, windows, observed_at, created_at, updated_at) VALUES ('anthropic', NULL, 'warning', 'not json', 1790000000000, 1, 1)",
    );
    await db.execute(
      "INSERT INTO provider_limits (provider_id, plan, status, windows, observed_at, created_at, updated_at) VALUES ('retired', NULL, 'ok', '[]', 1790000000000, 1, 1)",
    );

    expect(await listProviderLimits({ db })).toEqual([
      {
        providerId: 'anthropic',
        plan: null,
        status: 'warning',
        windows: [],
        observedAt: new Date(1790000000000).toISOString(),
      },
    ]);
  });
});
