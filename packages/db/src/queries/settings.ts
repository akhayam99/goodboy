import type { Database, PlainStatement } from '../client';

type SettingsRow = {
  key: string;
  value: string;
  updated_at: number;
};

export const getSetting = async (db: Database, key: string): Promise<string | null> => {
  const rows = await db.select<SettingsRow>('SELECT * FROM settings WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
};

const SETTINGS_READ_CHUNK = 500;

type GetSettingsParams = {
  readonly db: Database;
  readonly keys: ReadonlyArray<string>;
};

export const getSettings = async ({
  db,
  keys,
}: GetSettingsParams): Promise<ReadonlyMap<string, string>> => {
  const found = new Map<string, string>();
  for (let start = 0; start < keys.length; start += SETTINGS_READ_CHUNK) {
    const chunk = keys.slice(start, start + SETTINGS_READ_CHUNK);
    const marks = chunk.map(() => '?').join(', ');
    const rows = await db.select<SettingsRow>(
      `SELECT * FROM settings WHERE key IN (${marks})`,
      chunk,
    );
    for (const row of rows) {
      found.set(row.key, row.value);
    }
  }
  return found;
};

export type SettingWrite = {
  readonly key: string;
  readonly value: string;
};

export const setSettingStatement = ({ key, value }: SettingWrite): PlainStatement => ({
  sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  params: [key, value, Date.now()],
});

export const setSetting = async (db: Database, key: string, value: string): Promise<void> => {
  const statement = setSettingStatement({ key, value });
  await db.execute(statement.sql, statement.params);
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

type InsertParams = {
  readonly db: Database;
  readonly key: string;
  readonly value: string;
};

export const insertSettingIfAbsent = async ({ db, key, value }: InsertParams): Promise<boolean> => {
  const result = await db.execute(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO NOTHING`,
    [key, value, Date.now()],
  );
  return result.rowsAffected === 1;
};

type DeleteParams = {
  readonly db: Database;
  readonly key: string;
  readonly expected: string;
};

export const deleteSettingIfUnchanged = async ({
  db,
  key,
  expected,
}: DeleteParams): Promise<boolean> => {
  const result = await db.execute('DELETE FROM settings WHERE key = ? AND value = ?', [
    key,
    expected,
  ]);
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
