import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import type { IsoDateTime, OverrideSettings, ProviderPolicy, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertWorkspace } from './workspace';
import { getWorkspaceOverrides, setWorkspaceOverrides } from './settings-overrides';

const WS_ID = 'w1' as WorkspaceId;

const POLICY: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'on', keepAfterLimit: true },
  { id: 'cursor', state: 'backup', payAsYouGo: true },
  { id: 'gemini', state: 'off' },
];

const legacyProviderPool = ({ raw }: { readonly raw: string | null }): string[] | null => {
  if (raw === null) {
    return null;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return null;
  }
  const pool: string[] = [];
  for (const value of parsed) {
    if (typeof value !== 'string') {
      return null;
    }
    pool.push(value);
  }
  return pool;
};

const EMPTY: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
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
  afterMerge: null,
  defaultBranchTemplate: null,
  workflowRules: null,
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
      providerPool: POLICY,
    });

    const stored = await getWorkspaceOverrides(db, WS_ID);

    expect(stored?.roleModels).toEqual({
      reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
    });
    expect(stored?.providerPool).toEqual(POLICY);
  });

  it('reads a legacy list of names as those providers on, in order, and the rest off', async () => {
    const db = await makeDb();
    await db.execute('UPDATE workspaces SET provider_pool = ? WHERE id = ?', [
      '["codex","anthropic"]',
      WS_ID,
    ]);

    const policy = (await getWorkspaceOverrides(db, WS_ID))?.providerPool ?? [];

    expect(policy.slice(0, 2)).toEqual([
      { id: 'codex', state: 'on' },
      { id: 'anthropic', state: 'on' },
    ]);
    expect(policy.slice(2).every((entry) => entry.state === 'off')).toBe(true);
    expect(policy.map((entry) => entry.id).sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it('puts the saved default first when it reads a legacy list of names', async () => {
    const db = await makeDb();
    await db.execute(
      'UPDATE workspaces SET provider_pool = ?, default_provider_id = ? WHERE id = ?',
      ['["anthropic","codex"]', 'codex', WS_ID],
    );

    const policy = (await getWorkspaceOverrides(db, WS_ID))?.providerPool ?? [];

    expect(policy.slice(0, 2).map((entry) => entry.id)).toEqual(['codex', 'anthropic']);
  });

  it('reads a column that is neither shape as no policy at all', async () => {
    const db = await makeDb();
    await db.execute('UPDATE workspaces SET provider_pool = ? WHERE id = ?', [
      '[{"id":"codex","state":"sometimes"}]',
      WS_ID,
    ]);

    expect((await getWorkspaceOverrides(db, WS_ID))?.providerPool).toBeNull();
  });

  it('writes the new shape so the 0.15.4 reader falls back to every provider', async () => {
    const db = await makeDb();
    await setWorkspaceOverrides(db, WS_ID, { ...EMPTY, providerPool: POLICY });
    const [row] = await db.select<{ provider_pool: string | null }>(
      'SELECT provider_pool FROM workspaces WHERE id = ?',
      [WS_ID],
    );

    expect(legacyProviderPool({ raw: row?.provider_pool ?? null })).toBeNull();
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
