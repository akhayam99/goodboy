import { describe, expect, it } from 'vitest';
import type { IsoDateTime, OverrideSettings, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import { insertWorkspace } from './workspace';
import { getWorkspaceOverrides, setWorkspaceOverrides } from './settings-overrides';

const WS_ID = 'w1' as WorkspaceId;

const EMPTY: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  scoutFanout: null,
};

async function makeDb() {
  const db = makeTestDatabase();
  await migrate(db);
  const now = new Date().toISOString() as IsoDateTime;
  await insertWorkspace(db, {
    id: WS_ID,
    name: 'my-repo',
    rootPath: '/tmp/my-repo',
    createdAt: now,
    updatedAt: now,
  });
  return db;
}

describe('workspace role model overrides', () => {
  it('round-trips role preferences through the overrides row', async () => {
    const db = await makeDb();
    await setWorkspaceOverrides(db, WS_ID, {
      ...EMPTY,
      roleModels: {
        reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
      },
    });

    const stored = await getWorkspaceOverrides(db, WS_ID);

    expect(stored?.roleModels).toEqual({
      reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
    });
  });

  it('stores no row value for an empty preference map', async () => {
    const db = await makeDb();
    await setWorkspaceOverrides(db, WS_ID, { ...EMPTY, roleModels: {} });

    expect((await getWorkspaceOverrides(db, WS_ID))?.roleModels).toBeNull();
  });
});
