import { describe, expect, it } from 'vitest';
import { setSetting } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  AUTO_TREE_LIMIT_DEFAULT_USD,
  autoTreeLimitKey,
  parseAutoTreeLimit,
  readAutoTreeLimit,
  writeAutoTreeLimit,
} from './autoTreeLimit';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });

describe('the Auto tree limit of a workspace', () => {
  it('proposes 5 USD, and is unset until the person confirms one', async () => {
    const db = await makeMigratedTestDatabase();

    expect(AUTO_TREE_LIMIT_DEFAULT_USD).toBe(5);
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBeNull();
  });

  it('stores one limit per workspace and swaps it against what it read', async () => {
    const db = await makeMigratedTestDatabase();

    await writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 8 });
    await writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 12.5 });
    await writeAutoTreeLimit({ db, workspaceId: NORTHWIND, usd: 3 });

    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBe(12.5);
    expect(await readAutoTreeLimit({ db, workspaceId: NORTHWIND })).toBe(3);
  });

  it('refuses an amount that is not above zero and keeps the stored limit', async () => {
    const db = await makeMigratedTestDatabase();
    await writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 8 });

    await expect(writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: 0 })).rejects.toThrow(
      'more than zero',
    );
    await expect(
      writeAutoTreeLimit({ db, workspaceId: HARBORLINE, usd: Number.NaN }),
    ).rejects.toThrow();

    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBe(8);
  });

  it('reads a malformed stored value as unset', async () => {
    const db = await makeMigratedTestDatabase();
    await setSetting(db, autoTreeLimitKey({ workspaceId: HARBORLINE }), 'lots');

    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBeNull();
    expect(parseAutoTreeLimit({ raw: '-2' })).toBeNull();
    expect(parseAutoTreeLimit({ raw: '7.5' })).toBe(7.5);
    expect(parseAutoTreeLimit({ raw: undefined })).toBeNull();
  });
});
