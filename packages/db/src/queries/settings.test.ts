import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  deleteSetting,
  getSetting,
  listSettingsWithPrefix,
  replaceSettingIfUnchanged,
  setSetting,
} from './settings';

describe('settings queries', () => {
  it('replaces a value only while it still holds what the caller read', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, 'restart.interrupted_runs', 'old');

    expect(
      await replaceSettingIfUnchanged(db, {
        key: 'restart.interrupted_runs',
        expected: 'old',
        value: 'first',
      }),
    ).toBe(true);
    expect(
      await replaceSettingIfUnchanged(db, {
        key: 'restart.interrupted_runs',
        expected: 'old',
        value: 'second',
      }),
    ).toBe(false);
    expect(await getSetting(db, 'restart.interrupted_runs')).toBe('first');
  });

  it('lists only the keys under a prefix, taking a percent sign literally', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, 'window.layout.main', 'a');
    await setSetting(db, 'window.layout.win-2', 'b');
    await setSetting(db, 'window.layoutx', 'c');
    await setSetting(db, 'window%other', 'd');

    expect(await listSettingsWithPrefix(db, 'window.layout.')).toEqual([
      { key: 'window.layout.main', value: 'a' },
      { key: 'window.layout.win-2', value: 'b' },
    ]);
    expect(await listSettingsWithPrefix(db, 'window%')).toEqual([
      { key: 'window%other', value: 'd' },
    ]);
  });

  it('deletes one key', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, 'restart.reason', 'x');
    await deleteSetting(db, 'restart.reason');
    expect(await getSetting(db, 'restart.reason')).toBeNull();
  });
});
