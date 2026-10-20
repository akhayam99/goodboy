import { describe, expect, it } from 'vitest';
import { getSetting, setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { SETTING_OVERVIEW_LAYOUT } from '../../settings/settings';
import { writeOverviewLayout } from './writeOverviewLayout';

type FlakyParams = {
  readonly db: Database;
  readonly isCommitFirst: boolean;
};

const failingOnce = ({ db, isCommitFirst }: FlakyParams): Database => {
  let isSpent = false;
  return {
    ...db,
    execute: async (sql, params) => {
      const isWrite = sql.startsWith('UPDATE settings') || sql.startsWith('INSERT INTO settings');
      if (!isWrite || isSpent) {
        return db.execute(sql, params);
      }
      isSpent = true;
      if (isCommitFirst) {
        await db.execute(sql, params);
      }
      throw new Error('the answer was lost');
    },
  };
};

describe('writeOverviewLayout', () => {
  it('inserts the first value and swaps later ones against what it read', async () => {
    const db = await makeMigratedTestDatabase();

    await writeOverviewLayout({ db, layout: 'new' });
    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('new');
    await writeOverviewLayout({ db, layout: 'classic' });
    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('classic');
  });

  it('is a no-op when another window already stored the value', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');

    await writeOverviewLayout({ db, layout: 'new' });

    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('new');
  });

  it('two windows flipping at once end on one stored value and neither throws', async () => {
    const db = await makeMigratedTestDatabase();

    await Promise.all([
      writeOverviewLayout({ db, layout: 'new' }),
      writeOverviewLayout({ db, layout: 'classic' }),
    ]);

    expect(['new', 'classic']).toContain(await getSetting(db, SETTING_OVERVIEW_LAYOUT));
  });

  it('rereads after a lost answer and accepts a write that did commit', async () => {
    const db = await makeMigratedTestDatabase();

    await writeOverviewLayout({ db: failingOnce({ db, isCommitFirst: true }), layout: 'new' });

    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('new');
  });

  it('rethrows a write that never committed and leaves the stored value alone', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'classic');

    await expect(
      writeOverviewLayout({ db: failingOnce({ db, isCommitFirst: false }), layout: 'new' }),
    ).rejects.toThrow('the answer was lost');

    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('classic');
  });

  it('gives up after a second lost swap and never overwrites', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'classic');
    let reads = 0;
    const racing: Database = {
      ...db,
      select: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
        const rows = await db.select<T>(sql, params);
        reads += 1;
        await setSetting(db, SETTING_OVERVIEW_LAYOUT, reads % 2 === 0 ? 'classic' : 'other');
        return rows;
      },
    };

    await expect(writeOverviewLayout({ db: racing, layout: 'new' })).rejects.toThrow(
      'changed in another window',
    );

    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).not.toBe('new');
  });
});
