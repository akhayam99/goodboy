import Database from 'better-sqlite3';
import type { Database as DatabaseInterface } from '../client';
import { migrations } from '../migrations/index';
import { migrate } from '../migrations/runner';

const wrapDatabase = (db: Database.Database): DatabaseInterface => ({
  async exec(sql) {
    db.exec(sql);
  },
  async execute(sql, params = []) {
    const stmt = db.prepare(sql);
    const result = stmt.run(...(params as ReadonlyArray<never>));
    return { rowsAffected: result.changes };
  },
  async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...(params as ReadonlyArray<never>)) as unknown as ReadonlyArray<T>;
  },
});

const openDatabase = (source: string | Buffer): Database.Database => {
  const db = new Database(source);
  db.pragma('foreign_keys = ON');
  return db;
};

export const makeTestDatabase = (filename = ':memory:'): DatabaseInterface =>
  wrapDatabase(openDatabase(filename));

const LATEST_VERSION = Math.max(...migrations.map((migration) => migration.version));

const templateByVersion = new Map<number, Promise<Buffer>>();

const buildTemplate = async ({ throughVersion }: { throughVersion: number }): Promise<Buffer> => {
  const raw = openDatabase(':memory:');
  await migrate(
    wrapDatabase(raw),
    migrations.filter((migration) => migration.version <= throughVersion),
  );
  const buffer = raw.serialize();
  raw.close();
  return buffer;
};

export const makeMigratedTestDatabase = async ({
  throughVersion = LATEST_VERSION,
}: { throughVersion?: number } = {}): Promise<DatabaseInterface> => {
  const cached = templateByVersion.get(throughVersion);
  const template = cached ?? buildTemplate({ throughVersion });
  if (cached == null) {
    templateByVersion.set(throughVersion, template);
  }
  return wrapDatabase(openDatabase(await template));
};
