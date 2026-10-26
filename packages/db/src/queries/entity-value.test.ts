import { describe, expect, it } from 'vitest';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  deleteProjectValue,
  getProjectValue,
  getWorkspaceValue,
  insertProjectValueIfAbsent,
  insertWorkspaceValueIfAbsent,
  listProjectValues,
  replaceProjectValueIfUnchanged,
  replaceWorkspaceValueIfUnchanged,
  setProjectValue,
  setProjectValueStatement,
  setWorkspaceValue,
} from './entity-value';

const HARBORLINE = brandId<WorkspaceId>({ value: 'harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'northwind' });
const LEDGER = brandId<ProjectId>({ value: 'ledger-core' });
const NOTIFY = brandId<ProjectId>({ value: 'notify-relay' });

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1), ('northwind', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('ledger-core', 'harborline', 'ledger-core', '/repo/ledger-core', 'folder', 1, 1), ('notify-relay', 'northwind', 'notify-relay', '/repo/notify-relay', 'folder', 1, 1)",
  );
  return db;
};

describe('workspace values', () => {
  it('reads nothing before a write, then what was written, per workspace', async () => {
    const db = await seed();
    expect(
      await getWorkspaceValue({ db, workspaceId: HARBORLINE, key: 'auto.treeLimitUsd' }),
    ).toBeNull();

    await setWorkspaceValue({ db, workspaceId: HARBORLINE, key: 'auto.treeLimitUsd', value: '7' });
    await setWorkspaceValue({ db, workspaceId: HARBORLINE, key: 'auto.treeLimitUsd', value: '9' });

    expect(await getWorkspaceValue({ db, workspaceId: HARBORLINE, key: 'auto.treeLimitUsd' })).toBe(
      '9',
    );
    expect(
      await getWorkspaceValue({ db, workspaceId: NORTHWIND, key: 'auto.treeLimitUsd' }),
    ).toBeNull();
  });

  it('inserts only when absent, and replaces only an unchanged value', async () => {
    const db = await seed();
    const key = 'sessions.pinned';

    expect(
      await insertWorkspaceValueIfAbsent({ db, workspaceId: HARBORLINE, key, value: 'a' }),
    ).toBe(true);
    expect(
      await insertWorkspaceValueIfAbsent({ db, workspaceId: HARBORLINE, key, value: 'b' }),
    ).toBe(false);
    expect(
      await replaceWorkspaceValueIfUnchanged({
        db,
        workspaceId: HARBORLINE,
        key,
        expected: 'x',
        value: 'c',
      }),
    ).toBe(false);
    expect(
      await replaceWorkspaceValueIfUnchanged({
        db,
        workspaceId: HARBORLINE,
        key,
        expected: 'a',
        value: 'c',
      }),
    ).toBe(true);

    expect(await getWorkspaceValue({ db, workspaceId: HARBORLINE, key })).toBe('c');
  });

  it('refuses a value for a workspace that does not exist', async () => {
    const db = await seed();

    await expect(
      setWorkspaceValue({
        db,
        workspaceId: brandId<WorkspaceId>({ value: 'missing' }),
        key: 'sessions.pinned',
        value: '[]',
      }),
    ).rejects.toThrow();
  });
});

describe('project values', () => {
  it('reads, replaces and deletes per project', async () => {
    const db = await seed();

    await setProjectValue({ db, projectId: LEDGER, key: 'folder.purpose', value: 'code' });
    await setProjectValue({ db, projectId: NOTIFY, key: 'folder.purpose', value: 'documents' });
    await setProjectValue({ db, projectId: LEDGER, key: 'folder.purpose', value: 'documents' });
    await deleteProjectValue({ db, projectId: NOTIFY, key: 'folder.purpose' });

    expect(await getProjectValue({ db, projectId: LEDGER, key: 'folder.purpose' })).toBe(
      'documents',
    );
    expect(await getProjectValue({ db, projectId: NOTIFY, key: 'folder.purpose' })).toBeNull();
  });

  it('inserts only when absent and replaces only an unchanged value', async () => {
    const db = await seed();
    const key = 'folder.purpose';

    expect(await insertProjectValueIfAbsent({ db, projectId: LEDGER, key, value: 'code' })).toBe(
      true,
    );
    expect(
      await insertProjectValueIfAbsent({ db, projectId: LEDGER, key, value: 'documents' }),
    ).toBe(false);
    expect(
      await replaceProjectValueIfUnchanged({
        db,
        projectId: LEDGER,
        key,
        expected: 'documents',
        value: 'x',
      }),
    ).toBe(false);
    expect(
      await replaceProjectValueIfUnchanged({
        db,
        projectId: LEDGER,
        key,
        expected: 'code',
        value: 'documents',
      }),
    ).toBe(true);
  });

  it('lists every project that holds a key, in id order', async () => {
    const db = await seed();
    await setProjectValue({ db, projectId: NOTIFY, key: 'folder.purpose', value: 'documents' });
    await setProjectValue({ db, projectId: LEDGER, key: 'folder.purpose', value: 'code' });
    await setProjectValue({ db, projectId: LEDGER, key: 'folder.git', value: 'in-place' });

    expect(await listProjectValues({ db, key: 'folder.purpose' })).toEqual([
      { projectId: LEDGER, value: 'code' },
      { projectId: NOTIFY, value: 'documents' },
    ]);
  });

  it('writes in a transaction through a statement, after the project row', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
    );

    await db.transaction({
      statements: [
        {
          sql: "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('ledger-core', 'harborline', 'ledger-core', '/repo/ledger-core', 'folder', 1, 1)",
          params: [],
        },
        setProjectValueStatement({ projectId: LEDGER, key: 'folder.purpose', value: 'code' }),
      ],
    });

    expect(await getProjectValue({ db, projectId: LEDGER, key: 'folder.purpose' })).toBe('code');
  });
});
