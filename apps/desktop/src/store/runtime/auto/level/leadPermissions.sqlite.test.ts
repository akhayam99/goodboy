import { describe, expect, it, vi } from 'vitest';
import { LEAD_PERMISSION_KEYS, LEAD_PERMISSION_PRESETS, type AutoLevel } from '@goodboy/core/auto';
import {
  getAutoTreePermissions,
  getWorkspaceValue,
  setSetting,
  setWorkspaceValue,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { SETTING_AUTO_PLAN_APPROVAL } from '../../../../features/settings/settings';
import { makeAutoWorld, WORLD_NOW, WORLD_TREE } from '../testing/autoWorld';
import { readLeadPermissions } from './readLeadPermissions';
import { writeAutoLevel } from './writeAutoLevel';
import { writeLeadPermission } from './writeLeadPermission';

const tree = { treeId: WORLD_TREE };
const workspace = { workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }) };
const LEVELS: ReadonlyArray<AutoLevel> = ['step', 'plan', 'run'];

type ValuesParams = {
  readonly permissions: Awaited<ReturnType<typeof readLeadPermissions>>;
};

const valuesOf = ({ permissions }: ValuesParams) =>
  Object.fromEntries(LEAD_PERMISSION_KEYS.map((key) => [key, permissions.rows[key].value]));

describe('Lead permissions in the database', () => {
  it.each(
    LEVELS.flatMap((level) => [true, false].map((isWorkFlowOn) => [level, isWorkFlowOn] as const)),
  )(
    'reads a session at %s exactly as its level today, switch on %s',
    async (level, isWorkFlowOn) => {
      const { db } = await makeAutoWorld();
      await writeAutoLevel({ db, target: { sessionId: AUTO_SEED_SESSION }, level });
      const permissions = await readLeadPermissions({ db, target: tree, isWorkFlowOn });
      expect(valuesOf({ permissions })).toEqual(LEAD_PERMISSION_PRESETS[level]);
      expect(permissions.preset).toBe(level);
      expect(permissions.spendLimitUsd).toBe(5);
      const isEveryChildAsked = level === 'step';
      expect(permissions.rows.startReaders.value === 'ask').toBe(isEveryChildAsked);
      expect(permissions.rows.startWriters.value === 'ask').toBe(isEveryChildAsked);
      expect(permissions.rows.approvePlan.value === 'ask').toBe(level !== 'run');
    },
  );

  it('follows the workspace level for a session without its own', async () => {
    const { db } = await makeAutoWorld();
    await writeAutoLevel({ db, target: workspace, level: 'run' });
    const permissions = await readLeadPermissions({ db, target: tree, isWorkFlowOn: true });
    expect(permissions.preset).toBe('run');
    expect(permissions.rows.startWriters.source).toBe('workspace');
  });

  it('writes a Lead row, shows it as this Lead and resets it to the default', async () => {
    const { db } = await makeAutoWorld();
    await writeLeadPermission({
      db,
      target: workspace,
      change: { key: 'push', value: 'ask' },
      nowMs: WORLD_NOW,
    });
    await writeLeadPermission({
      db,
      target: tree,
      change: { key: 'push', value: 'whenChecksPass' },
      nowMs: WORLD_NOW,
    });
    const overridden = await readLeadPermissions({ db, target: tree, isWorkFlowOn: true });
    expect(overridden.rows.push).toEqual({ value: 'whenChecksPass', source: 'lead', note: null });
    await writeLeadPermission({
      db,
      target: tree,
      change: { key: 'push', value: null },
      nowMs: WORLD_NOW,
    });
    expect(await getAutoTreePermissions({ db, treeId: WORLD_TREE })).toBe('{}');
    const reset = await readLeadPermissions({ db, target: tree, isWorkFlowOn: true });
    expect(reset.rows.push).toEqual({ value: 'ask', source: 'default', note: null });
    expect(reset.preset).toBe('custom');
    const switchedOff = await readLeadPermissions({ db, target: tree, isWorkFlowOn: false });
    expect(switchedOff.rows.push.source).toBe('workspace');
  });

  it('reads the hidden plan setting until a row holds the plan', async () => {
    const { db } = await makeAutoWorld();
    await setSetting(db, SETTING_AUTO_PLAN_APPROVAL, 'false');
    const seeded = await readLeadPermissions({ db, target: tree, isWorkFlowOn: true });
    expect(seeded.rows.approvePlan).toEqual({ value: 'skip', source: 'setting', note: null });
    expect(seeded.rows.startWriters.value).toBe('free');
    await writeLeadPermission({
      db,
      target: workspace,
      change: { key: 'approvePlan', value: 'ask' },
      nowMs: WORLD_NOW,
    });
    const owned = await readLeadPermissions({ db, target: tree, isWorkFlowOn: true });
    expect(owned.rows.approvePlan).toEqual({ value: 'ask', source: 'default', note: null });
    expect(owned.rows.startWriters.value).toBe('afterPlan');
  });

  it('keeps both rows when two windows write the default, the second retrying on the new value', async () => {
    const { db } = await makeAutoWorld();
    const execute = db.execute.bind(db);
    vi.spyOn(db, 'execute').mockImplementationOnce(async (sql, params) => {
      await setWorkspaceValue({
        db: { ...db, execute },
        ...workspace,
        key: 'auto.permissions',
        value: JSON.stringify({ dependencies: 'ask' }),
      });
      return execute(sql, params);
    });
    await writeLeadPermission({
      db,
      target: workspace,
      change: { key: 'pullRequest', value: 'ask' },
      nowMs: WORLD_NOW,
    });
    expect(
      JSON.parse((await getWorkspaceValue({ db, ...workspace, key: 'auto.permissions' })) ?? ''),
    ).toEqual({ dependencies: 'ask', pullRequest: 'ask' });
  });

  it('retries a lost swap on the Lead row once against the other window', async () => {
    const { db } = await makeAutoWorld();
    const execute = db.execute.bind(db);
    vi.spyOn(db, 'execute').mockImplementationOnce(async (sql, params) => {
      await execute('UPDATE auto_trees SET permissions = \'{"addProject":"ask"}\' WHERE id = ?', [
        WORLD_TREE,
      ]);
      return execute(sql, params);
    });
    await writeLeadPermission({
      db,
      target: tree,
      change: { key: 'closeWork', value: 'lead' },
      nowMs: WORLD_NOW,
    });
    const permissions = await readLeadPermissions({ db, target: tree, isWorkFlowOn: true });
    expect(permissions.rows.addProject.source).toBe('lead');
    expect(permissions.rows.closeWork).toEqual({ value: 'lead', source: 'lead', note: null });
  });

  it('keeps the old value after a failed write and reports repeated contention', async () => {
    const { db } = await makeAutoWorld();
    await writeLeadPermission({
      db,
      target: tree,
      change: { key: 'dependencies', value: 'ask' },
      nowMs: WORLD_NOW,
    });
    const failing = vi.spyOn(db, 'execute').mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(
      writeLeadPermission({
        db,
        target: tree,
        change: { key: 'dependencies', value: 'allow' },
        nowMs: WORLD_NOW,
      }),
    ).rejects.toThrow('disk unavailable');
    failing.mockRestore();
    const kept = await readLeadPermissions({ db, target: tree, isWorkFlowOn: true });
    expect(kept.rows.dependencies.value).toBe('ask');
    vi.spyOn(db, 'execute').mockResolvedValue({ rowsAffected: 0 });
    await expect(
      writeLeadPermission({
        db,
        target: workspace,
        change: { key: 'push', value: 'ask' },
        nowMs: WORLD_NOW,
      }),
    ).rejects.toThrow('another window');
    vi.restoreAllMocks();
    expect(await getWorkspaceValue({ db, ...workspace, key: 'auto.permissions' })).toBeNull();
  });

  it('refuses a read or a write for a Lead that no longer exists', async () => {
    const { db } = await makeAutoWorld();
    const gone = { treeId: brandId<typeof WORLD_TREE>({ value: 'tree-gone' }) };
    await expect(readLeadPermissions({ db, target: gone, isWorkFlowOn: true })).rejects.toThrow(
      'no longer exists',
    );
    await expect(
      writeLeadPermission({
        db,
        target: gone,
        change: { key: 'push', value: 'ask' },
        nowMs: WORLD_NOW,
      }),
    ).rejects.toThrow('no longer exists');
  });
});
