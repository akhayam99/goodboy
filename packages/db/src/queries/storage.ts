import type { Database } from '../client';

type StorageParams = {
  readonly db: Database;
};

type PageCountRow = {
  page_count: number;
};

type PageSizeRow = {
  page_size: number;
};

export const getDatabaseSizeBytes = async ({ db }: StorageParams): Promise<number> => {
  const pageCountRows = await db.select<PageCountRow>('PRAGMA page_count');
  const pageSizeRows = await db.select<PageSizeRow>('PRAGMA page_size');
  const pageCount = pageCountRows[0]?.page_count ?? 0;
  const pageSize = pageSizeRows[0]?.page_size ?? 0;
  return pageCount * pageSize;
};

export const vacuumDatabase = async ({ db }: StorageParams): Promise<void> => {
  await db.exec('VACUUM');
};
