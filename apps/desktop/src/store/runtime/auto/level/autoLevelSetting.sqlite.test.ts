import { describe, expect, it, vi } from 'vitest';
import { getWorkspaceValue, setWorkspaceValue } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { makeAutoWorld } from '../testing/autoWorld';
import { readAutoLevel } from './readAutoLevel';
import { writeAutoLevel } from './writeAutoLevel';

const target = { sessionId: AUTO_SEED_SESSION };
const workspace = { workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }) };

describe('persisted Auto levels', () => {
  it('defaults to After the plan independently of the workflow default', async () => {
    const { db } = await makeAutoWorld();
    await db.execute('UPDATE workspaces SET workflow_rules = ? WHERE id = ?', [
      JSON.stringify({ autonomy: 'step' }),
      workspace.workspaceId,
    ]);
    expect(await readAutoLevel({ db, target })).toBe('plan');
    expect(await getWorkspaceValue({ db, ...workspace, key: 'auto.level' })).toBeNull();
  });

  it('uses a separate workspace default until the session has its own level', async () => {
    const { db } = await makeAutoWorld();
    await writeAutoLevel({ db, target: workspace, level: 'run' });
    expect(await readAutoLevel({ db, target })).toBe('run');
    await writeAutoLevel({ db, target, level: 'step' });
    await writeAutoLevel({ db, target: workspace, level: 'plan' });
    expect(await readAutoLevel({ db, target })).toBe('step');
    expect(await readAutoLevel({ db, target: workspace })).toBe('plan');
  });

  it('ignores invalid stored levels and keeps defaults scoped to the workspace', async () => {
    const { db } = await makeAutoWorld();
    await setWorkspaceValue({
      db,
      ...workspace,
      key: 'auto.level',
      value: JSON.stringify({ sessions: { [target.sessionId]: 'unknown' } }),
    });
    await writeAutoLevel({ db, target: workspace, level: 'step' });
    expect(await readAutoLevel({ db, target })).toBe('step');
    await setWorkspaceValue({ db, ...workspace, key: 'auto.level', value: 'unknown' });
    expect(await readAutoLevel({ db, target })).toBe('plan');
    const northwind = { workspaceId: brandId<WorkspaceId>({ value: 'workspace-northwind' }) };
    expect(await readAutoLevel({ db, target: northwind })).toBe('plan');
  });

  it('persists two writers in order and rereads the last successful write', async () => {
    const { db } = await makeAutoWorld();
    const second = { ...db };
    await writeAutoLevel({ db, target, level: 'step' });
    await writeAutoLevel({ db: second, target, level: 'run' });
    expect(await readAutoLevel({ db, target })).toBe('run');
    await writeAutoLevel({ db, target, level: 'plan' });
    expect(await readAutoLevel({ db: second, target })).toBe('plan');
  });

  it('preserves both a workspace default and a session override written concurrently', async () => {
    const { db } = await makeAutoWorld();
    await Promise.all([
      writeAutoLevel({ db, target: workspace, level: 'run' }),
      writeAutoLevel({ db: { ...db }, target, level: 'step' }),
    ]);
    expect(await readAutoLevel({ db, target })).toBe('step');
    expect(await readAutoLevel({ db, target: workspace })).toBe('run');
  });

  it('keeps the previous level after failure and supports retry and restoring it', async () => {
    const { db } = await makeAutoWorld();
    await writeAutoLevel({ db, target, level: 'step' });
    const execute = vi.spyOn(db, 'execute').mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(writeAutoLevel({ db, target, level: 'run' })).rejects.toThrow('disk unavailable');
    expect(await readAutoLevel({ db, target })).toBe('step');
    execute.mockRestore();
    await writeAutoLevel({ db, target, level: 'run' });
    expect(await readAutoLevel({ db, target })).toBe('run');
    await writeAutoLevel({ db, target, level: 'step' });
    expect(await readAutoLevel({ db, target })).toBe('step');
  });

  it('retries a lost compare and swap against the level another writer saved', async () => {
    const { db } = await makeAutoWorld();
    const execute = db.execute.bind(db);
    vi.spyOn(db, 'execute').mockImplementationOnce(async (sql, params) => {
      await execute(sql, params);
      await setWorkspaceValue({
        db: { ...db, execute },
        ...workspace,
        key: 'auto.level',
        value: JSON.stringify({ defaultLevel: 'step', sessions: {} }),
      });
      return { rowsAffected: 0 };
    });
    await writeAutoLevel({ db, target, level: 'run' });
    expect(await readAutoLevel({ db, target })).toBe('run');
    expect(await readAutoLevel({ db, target: workspace })).toBe('step');
  });

  it('accepts an uncertain successful write when a retry reads the requested level', async () => {
    const { db } = await makeAutoWorld();
    const execute = db.execute.bind(db);
    vi.spyOn(db, 'execute').mockImplementationOnce(async (sql, params) => {
      await execute(sql, params);
      throw new Error('reply lost');
    });
    await expect(writeAutoLevel({ db, target, level: 'run' })).rejects.toThrow('reply lost');
    await writeAutoLevel({ db, target, level: 'run' });
    expect(await readAutoLevel({ db, target })).toBe('run');
  });

  it('reports repeated contention without overwriting the other level', async () => {
    const { db } = await makeAutoWorld();
    await writeAutoLevel({ db, target, level: 'step' });
    vi.spyOn(db, 'execute').mockResolvedValue({ rowsAffected: 0 });
    await expect(writeAutoLevel({ db, target, level: 'run' })).rejects.toThrow('another window');
    expect(await readAutoLevel({ db, target })).toBe('step');
  });
});
