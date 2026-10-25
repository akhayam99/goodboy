import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  deleteSetting,
  deleteSettingIfUnchanged,
  getSetting,
  getSettings,
  insertSettingIfAbsent,
  listSettingsWithPrefix,
  replaceSettingIfUnchanged,
  setSetting,
} from './settings';

describe('settings queries', () => {
  it('reads several keys in one select and leaves out the keys that hold nothing', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, 'editor.binary', 'code');
    await setSetting(db, 'reopenLast', 'true');
    const select = db.select.bind(db);
    const statements: string[] = [];
    db.select = (sql, params) => {
      statements.push(sql);
      return select(sql, params);
    };

    const found = await getSettings({ db, keys: ['editor.binary', 'reopenLast', 'absent'] });

    expect(statements).toHaveLength(1);
    expect([...found.entries()]).toEqual([
      ['editor.binary', 'code'],
      ['reopenLast', 'true'],
    ]);
  });

  it('answers an empty list without a select and reads a long list in chunks', async () => {
    const db = await makeMigratedTestDatabase();
    const keys = Array.from({ length: 1_200 }, (_, index) => `key.${index}`);
    await setSetting(db, 'key.1199', 'last');
    const select = db.select.bind(db);
    let selects = 0;
    db.select = (sql, params) => {
      selects += 1;
      return select(sql, params);
    };

    expect((await getSettings({ db, keys: [] })).size).toBe(0);
    expect(selects).toBe(0);
    expect((await getSettings({ db, keys })).get('key.1199')).toBe('last');
    expect(selects).toBe(3);
  });

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

  it('inserts a missing key once and never overwrites an existing one', async () => {
    const db = await makeMigratedTestDatabase();

    expect(await insertSettingIfAbsent({ db, key: 'sessions.pinned.w1', value: 'first' })).toBe(
      true,
    );
    expect(await insertSettingIfAbsent({ db, key: 'sessions.pinned.w1', value: 'second' })).toBe(
      false,
    );
    expect(await getSetting(db, 'sessions.pinned.w1')).toBe('first');
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

  it('deletes a key only while it still holds the expected value', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, 'runs.defaultShape.session.s1', 'lead');

    expect(
      await deleteSettingIfUnchanged({ db, key: 'runs.defaultShape.session.s1', expected: 'plan' }),
    ).toBe(false);
    expect(await getSetting(db, 'runs.defaultShape.session.s1')).toBe('lead');
    expect(
      await deleteSettingIfUnchanged({ db, key: 'runs.defaultShape.session.s1', expected: 'lead' }),
    ).toBe(true);
    expect(await getSetting(db, 'runs.defaultShape.session.s1')).toBeNull();
  });
});
