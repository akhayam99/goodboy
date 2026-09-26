import { describe, expect, it } from 'vitest';
import type { IsoDateTime, OverrideSettings, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
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
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
};

async function makeDb() {
  const db = await makeMigratedTestDatabase();
  const now = new Date().toISOString() as IsoDateTime;
  await insertWorkspace({
    db,
    workspace: {
      id: WS_ID,
      name: 'my-repo',
      slug: 'my-repo',
      overrides: EMPTY,
      createdAt: now,
      updatedAt: now,
    },
  });
  return db;
}

describe('workspace overrides', () => {
  it('round-trips role preferences and the routing pool', async () => {
    const db = await makeDb();
    await setWorkspaceOverrides(db, WS_ID, {
      ...EMPTY,
      roleModels: {
        reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
      },
      providerPool: ['anthropic', 'codex'],
    });

    const stored = await getWorkspaceOverrides(db, WS_ID);

    expect(stored?.roleModels).toEqual({
      reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
    });
    expect(stored?.providerPool).toEqual(['anthropic', 'codex']);
  });

  it('round-trips the attribution footer switch', async () => {
    const db = await makeDb();

    expect((await getWorkspaceOverrides(db, WS_ID))?.attributionFooter).toBeNull();

    await setWorkspaceOverrides(db, WS_ID, { ...EMPTY, attributionFooter: false });
    expect((await getWorkspaceOverrides(db, WS_ID))?.attributionFooter).toBe(false);

    await setWorkspaceOverrides(db, WS_ID, { ...EMPTY, attributionFooter: true });
    expect((await getWorkspaceOverrides(db, WS_ID))?.attributionFooter).toBe(true);

    await setWorkspaceOverrides(db, WS_ID, { ...EMPTY, attributionFooter: null });
    expect((await getWorkspaceOverrides(db, WS_ID))?.attributionFooter).toBeNull();
  });

  it('stores no row value for an empty preference map', async () => {
    const db = await makeDb();
    await setWorkspaceOverrides(db, WS_ID, { ...EMPTY, roleModels: {} });

    expect((await getWorkspaceOverrides(db, WS_ID))?.roleModels).toBeNull();
  });
});
