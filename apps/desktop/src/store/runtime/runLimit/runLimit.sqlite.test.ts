import { describe, expect, it, vi } from 'vitest';
import { getWorkspaceValue, setWorkspaceValue } from '@goodboy/db';
import { brandId, type AgentId, type WorkspaceId } from '@goodboy/types';
import { makeAutoWorld } from '../auto/testing/autoWorld';
import { readRunLimit } from './readRunLimit';
import { writeRunLimit } from './writeRunLimit';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const northwind = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const FIRST = brandId<AgentId>({ value: 'agent-ledger-core' });
const SECOND = brandId<AgentId>({ value: 'agent-notify-relay' });

describe('run limit of a Lead', () => {
  it('reads nothing for an agent started without a limit', async () => {
    const { db } = await makeAutoWorld();

    expect(await readRunLimit({ db, workspaceId, agentId: FIRST })).toBeNull();
    expect(await getWorkspaceValue({ db, workspaceId, key: 'run.limit' })).toBeNull();
  });

  it('writes the limit next to the agent id and reads it back', async () => {
    const { db } = await makeAutoWorld();

    await writeRunLimit({ db, workspaceId, agentId: FIRST, usd: 3 });

    expect(await readRunLimit({ db, workspaceId, agentId: FIRST })).toBe(3);
    expect(
      JSON.parse((await getWorkspaceValue({ db, workspaceId, key: 'run.limit' })) ?? ''),
    ).toEqual({ agents: { [FIRST]: 3 } });
  });

  it('keeps the limit of another agent and another workspace apart', async () => {
    const { db } = await makeAutoWorld();

    await writeRunLimit({ db, workspaceId, agentId: FIRST, usd: 3 });
    await writeRunLimit({ db, workspaceId, agentId: SECOND, usd: 12 });

    expect(await readRunLimit({ db, workspaceId, agentId: FIRST })).toBe(3);
    expect(await readRunLimit({ db, workspaceId, agentId: SECOND })).toBe(12);
    expect(await readRunLimit({ db, workspaceId: northwind, agentId: FIRST })).toBeNull();
  });

  it('keeps both writes when two windows write different agents at once', async () => {
    const { db } = await makeAutoWorld();

    await Promise.all([
      writeRunLimit({ db, workspaceId, agentId: FIRST, usd: 3 }),
      writeRunLimit({ db: { ...db }, workspaceId, agentId: SECOND, usd: 12 }),
    ]);

    expect(await readRunLimit({ db, workspaceId, agentId: FIRST })).toBe(3);
    expect(await readRunLimit({ db, workspaceId, agentId: SECOND })).toBe(12);
  });

  it('swaps only when the stored value is the one it read', async () => {
    const { db } = await makeAutoWorld();
    await writeRunLimit({ db, workspaceId, agentId: FIRST, usd: 3 });
    const stored = (await getWorkspaceValue({ db, workspaceId, key: 'run.limit' })) ?? '';
    const other = JSON.stringify({ agents: { [FIRST]: 3, [SECOND]: 12 } });
    const select = vi.spyOn(db, 'select');
    select.mockResolvedValueOnce([{ value: stored }]);
    await setWorkspaceValue({ db, workspaceId, key: 'run.limit', value: other });

    await writeRunLimit({ db, workspaceId, agentId: FIRST, usd: 5 });
    select.mockRestore();

    expect(await readRunLimit({ db, workspaceId, agentId: FIRST })).toBe(5);
    expect(await readRunLimit({ db, workspaceId, agentId: SECOND })).toBe(12);
  });

  it('refuses a limit that is not more than $0 and writes nothing', async () => {
    const { db } = await makeAutoWorld();

    await expect(writeRunLimit({ db, workspaceId, agentId: FIRST, usd: 0 })).rejects.toThrow(
      'A run limit must be more than $0.',
    );

    expect(await getWorkspaceValue({ db, workspaceId, key: 'run.limit' })).toBeNull();
  });

  it('ignores a stored value that is not a limit', async () => {
    const { db } = await makeAutoWorld();
    await setWorkspaceValue({
      db,
      workspaceId,
      key: 'run.limit',
      value: JSON.stringify({ agents: { [FIRST]: 'three', [SECOND]: -2 } }),
    });

    expect(await readRunLimit({ db, workspaceId, agentId: FIRST })).toBeNull();
    expect(await readRunLimit({ db, workspaceId, agentId: SECOND })).toBeNull();
  });
});
