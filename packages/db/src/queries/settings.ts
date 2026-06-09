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
