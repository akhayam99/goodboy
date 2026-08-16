import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import {
  DATABASE_FILE_HINT,
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailable,
  tauriDatabase,
} from './db';

beforeEach(() => {
  invokeMock.mockReset();
});

const UNMANAGED_REJECTION =
  'state not managed for field `state` on command `db_select`. You must call `.manage()` before using this command';

describe('tauriDatabase', () => {
  it('turns a backend with no database into one honest failure', async () => {
    invokeMock.mockRejectedValue(UNMANAGED_REJECTION);

    await expect(tauriDatabase.select('SELECT 1')).rejects.toThrow(DATABASE_UNAVAILABLE_MESSAGE);
  });

  it('names the file the user has to move aside', () => {
    expect(DATABASE_UNAVAILABLE_MESSAGE).toContain(DATABASE_FILE_HINT);
    expect(DATABASE_FILE_HINT.startsWith('~/')).toBe(true);
  });

  it('marks that failure so the boot screen can drop a retry that cannot work', async () => {
    invokeMock.mockRejectedValue(UNMANAGED_REJECTION);

    const failure = await tauriDatabase.exec('PRAGMA user_version').catch((err: unknown) => err);
    expect(isDatabaseUnavailable(failure)).toBe(true);
  });

  it('lets an ordinary sql failure through untouched', async () => {
    invokeMock.mockRejectedValue(new Error('no such table: sessions'));

    const failure = await tauriDatabase.select('SELECT 1').catch((err: unknown) => err);
    expect(isDatabaseUnavailable(failure)).toBe(false);
    expect(failure).toBeInstanceOf(Error);
  });

  it('passes a successful query straight through', async () => {
    invokeMock.mockResolvedValue([{ version: 1 }]);

    await expect(tauriDatabase.select('SELECT version FROM schema_version')).resolves.toEqual([
      { version: 1 },
    ]);
  });
});
