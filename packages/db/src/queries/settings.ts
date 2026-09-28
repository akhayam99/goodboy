import type { Database } from '../client';

type SettingsRow = {
  key: string;
  value: string;
  updated_at: number;
};

export const getSetting = async (db: Database, key: string): Promise<string | null> => {
  const rows = await db.select<SettingsRow>('SELECT * FROM settings WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
};

export const setSetting = async (db: Database, key: string, value: string): Promise<void> => {
  await db.execute(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, Date.now()],
  );
};

type ReplaceParams = {
  readonly key: string;
  readonly expected: string;
  readonly value: string;
};

export const replaceSettingIfUnchanged = async (
  db: Database,
  { key, expected, value }: ReplaceParams,
): Promise<boolean> => {
  const result = await db.execute(
    'UPDATE settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?',
    [value, Date.now(), key, expected],
  );
  return result.rowsAffected === 1;
};

export const deleteSetting = async (db: Database, key: string): Promise<void> => {
  await db.execute('DELETE FROM settings WHERE key = ?', [key]);
};

export const listSettingsWithPrefix = async (
  db: Database,
  prefix: string,
): Promise<ReadonlyArray<{ readonly key: string; readonly value: string }>> => {
  const rows = await db.select<SettingsRow>(
    'SELECT * FROM settings WHERE substr(key, 1, ?) = ? ORDER BY key',
    [prefix.length, prefix],
  );
  return rows.map((row) => ({ key: row.key, value: row.value }));
};
