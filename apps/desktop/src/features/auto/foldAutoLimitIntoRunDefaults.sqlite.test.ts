import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { readAutoTreeLimit, writeAutoTreeLimit } from './autoTreeLimit';
import { foldAutoLimitIntoRunDefaults } from './foldAutoLimitIntoRunDefaults';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });

const migratedWithWorkspace = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-harborline', 'Harborline', 'harborline', 1, 1)`,
  );
  return db;
};

describe('folding the old Auto limit into the run defaults limit', () => {
  it('moves the stored Auto limit into an unset run limit and clears the old key', async () => {
    const db = await migratedWithWorkspace();
    await writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 8 });
    const saveRunLimit = vi.fn(async () => undefined);

    const isFolded = await foldAutoLimitIntoRunDefaults({
      db,
      workspaceId: HARBORLINE,
      runLimitUsd: null,
      saveRunLimit,
    });

    expect(isFolded).toBe(true);
    expect(saveRunLimit).toHaveBeenCalledWith({ usd: 8 });
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBeNull();
  });

  it('keeps the smaller of the two when the person had both', async () => {
    const db = await migratedWithWorkspace();
    await writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 8 });
    const saveRunLimit = vi.fn(async () => undefined);

    await foldAutoLimitIntoRunDefaults({
      db,
      workspaceId: HARBORLINE,
      runLimitUsd: 25,
      saveRunLimit,
    });

    expect(saveRunLimit).toHaveBeenCalledWith({ usd: 8 });
  });

  it('keeps a smaller run limit as it is', async () => {
    const db = await migratedWithWorkspace();
    await writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 40 });
    const saveRunLimit = vi.fn(async () => undefined);

    await foldAutoLimitIntoRunDefaults({
      db,
      workspaceId: HARBORLINE,
      runLimitUsd: 25,
      saveRunLimit,
    });

    expect(saveRunLimit).toHaveBeenCalledWith({ usd: 25 });
  });

  it('does nothing when no Auto limit was ever stored', async () => {
    const db = await migratedWithWorkspace();
    const saveRunLimit = vi.fn(async () => undefined);

    const isFolded = await foldAutoLimitIntoRunDefaults({
      db,
      workspaceId: HARBORLINE,
      runLimitUsd: 25,
      saveRunLimit,
    });

    expect(isFolded).toBe(false);
    expect(saveRunLimit).not.toHaveBeenCalled();
  });

  it('keeps the old value when saving the run limit fails', async () => {
    const db = await migratedWithWorkspace();
    await writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 8 });
    const saveRunLimit = vi.fn(async () => {
      throw new Error('disk full');
    });

    await expect(
      foldAutoLimitIntoRunDefaults({
        db,
        workspaceId: HARBORLINE,
        runLimitUsd: null,
        saveRunLimit,
      }),
    ).rejects.toThrow('disk full');

    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBe(8);
  });
});
