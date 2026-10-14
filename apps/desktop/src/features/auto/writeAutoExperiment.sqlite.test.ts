import { describe, expect, it } from 'vitest';
import { getSetting, setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';
import { readIsAutoOn } from './readIsAutoOn';
import { writeAutoExperiment } from './writeAutoExperiment';

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

describe('writeAutoExperiment', () => {
  it('inserts the first value and swaps later ones against what it read', async () => {
    const db = await makeMigratedTestDatabase();

    await writeAutoExperiment({ db, isOn: true });
    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBe('true');
    await writeAutoExperiment({ db, isOn: false });
    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBe('false');
  });

  it('is a no-op when another window already stored the value', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');

    await writeAutoExperiment({ db, isOn: true });

    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBe('true');
  });

  it('two windows toggling at once end on one stored value and neither throws', async () => {
    const db = await makeMigratedTestDatabase();

    await Promise.all([
      writeAutoExperiment({ db, isOn: true }),
      writeAutoExperiment({ db, isOn: false }),
    ]);

    const stored = await getSetting(db, SETTING_AUTO_EXPERIMENT);
    expect(['true', 'false']).toContain(stored);
  });

  it('rereads after a lost answer and accepts a write that did commit', async () => {
    const db = await makeMigratedTestDatabase();

    await writeAutoExperiment({ db: failingOnce({ db, isCommitFirst: true }), isOn: true });

    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBe('true');
  });

  it('rethrows a write that never committed and leaves the stored value alone', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'false');

    await expect(
      writeAutoExperiment({ db: failingOnce({ db, isCommitFirst: false }), isOn: true }),
    ).rejects.toThrow('the answer was lost');

    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBe('false');
  });

  it('gives up after a second lost swap and never overwrites', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'false');
    let reads = 0;
    const racing: Database = {
      ...db,
      select: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
        const rows = await db.select<T>(sql, params);
        reads += 1;
        await setSetting(db, SETTING_AUTO_EXPERIMENT, reads % 2 === 0 ? 'false' : 'other');
        return rows;
      },
    };

    await expect(writeAutoExperiment({ db: racing, isOn: true })).rejects.toThrow(
      'changed in another window',
    );

    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).not.toBe('true');
  });
});

describe('readIsAutoOn', () => {
  it('reads the stored value fresh and is off when the gate is closed', async () => {
    const db = await makeMigratedTestDatabase();
    expect(await readIsAutoOn({ db, isReleased: true })).toBe(false);

    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');

    expect(await readIsAutoOn({ db, isReleased: true })).toBe(true);
    expect(await readIsAutoOn({ db, isReleased: false })).toBe(false);
    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'false');
    expect(await readIsAutoOn({ db, isReleased: true })).toBe(false);
  });
});
