import { invoke } from '@tauri-apps/api/core';
import { migrate as runMigrations, type Database, type MigrateResult } from '@goodboy/db';

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
  async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
    return invoke('db_select', {
      sql,
      params: [...params],
    }) as Promise<ReadonlyArray<T>>;
  },
};

export const runDbMigrations = async (): Promise<MigrateResult> => {
  return runMigrations(tauriDatabase);
};

export const wipeDb = async (): Promise<MigrateResult> => {
  await invoke('db_wipe');
  return runMigrations(tauriDatabase);
};
