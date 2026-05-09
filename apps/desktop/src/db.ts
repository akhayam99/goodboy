import { invoke } from '@tauri-apps/api/core';
import { migrate as runMigrations, type Database, type MigrateResult } from '@kay-am/db';

export const tauriDatabase: Database = {
  async exec(sql) {
    await invoke('db_exec', { sql });
  },
  async execute(sql, params = []) {
    return invoke<{ rowsAffected: number }>('db_execute', {
      sql,
      params: [...params],
    });
  },
  async select(sql, params = []) {
    return invoke<ReadonlyArray<Record<string, unknown>>>('db_select', {
      sql,
      params: [...params],
    }) as unknown as Promise<ReadonlyArray<never>>;
  },
};

export async function runDbMigrations(): Promise<MigrateResult> {
  return runMigrations(tauriDatabase);
}

export async function wipeDb(): Promise<MigrateResult> {
  await invoke('db_wipe');
  return runMigrations(tauriDatabase);
}
