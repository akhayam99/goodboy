import { vi } from 'vitest';

vi.mock('../shared/lib/dbBoot', () => ({
  runDbMigrations: vi.fn(async () => undefined),
  restoreMigrationSnapshot: vi.fn(async (_params: { readonly path: string }) => ''),
  wipeDb: vi.fn(async () => undefined),
}));
