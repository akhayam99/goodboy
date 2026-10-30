import { describe, expect, it, vi } from 'vitest';
import { getWorkspaceValue, setWorkspaceValue } from '@goodboy/db';
import { brandId, type AgentId, type WorkspaceId } from '@goodboy/types';
import { makeAutoWorld } from '../auto/testing/autoWorld';
import { readRunGuidance } from './readRunGuidance';
import { writeRunGuidance } from './writeRunGuidance';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const northwind = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const FIRST = brandId<AgentId>({ value: 'agent-ledger-core' });
const SECOND = brandId<AgentId>({ value: 'agent-notify-relay' });

describe('run guidance of an agent', () => {
  it('reads nothing for an agent that never got guidance', async () => {
    const { db } = await makeAutoWorld();

    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBeNull();
    expect(await getWorkspaceValue({ db, workspaceId, key: 'run.guidance' })).toBeNull();
  });

  it('writes the text next to the agent id and reads it back trimmed', async () => {
    const { db } = await makeAutoWorld();

    await writeRunGuidance({ db, workspaceId, agentId: FIRST, text: '  Keep the diff small.  ' });

    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBe('Keep the diff small.');
    expect(
      JSON.parse((await getWorkspaceValue({ db, workspaceId, key: 'run.guidance' })) ?? ''),
    ).toEqual({
      agents: { [FIRST]: 'Keep the diff small.' },
    });
  });

  it('keeps the guidance of another agent and another workspace apart', async () => {
    const { db } = await makeAutoWorld();

    await writeRunGuidance({ db, workspaceId, agentId: FIRST, text: 'Keep the diff small.' });
    await writeRunGuidance({ db, workspaceId, agentId: SECOND, text: 'Reply in Italian.' });

    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBe('Keep the diff small.');
    expect(await readRunGuidance({ db, workspaceId, agentId: SECOND })).toBe('Reply in Italian.');
    expect(await readRunGuidance({ db, workspaceId: northwind, agentId: FIRST })).toBeNull();
  });

  it('keeps both writes when two windows write different agents at once', async () => {
    const { db } = await makeAutoWorld();

    await Promise.all([
      writeRunGuidance({ db, workspaceId, agentId: FIRST, text: 'Keep the diff small.' }),
      writeRunGuidance({ db: { ...db }, workspaceId, agentId: SECOND, text: 'Reply in Italian.' }),
    ]);

    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBe('Keep the diff small.');
    expect(await readRunGuidance({ db, workspaceId, agentId: SECOND })).toBe('Reply in Italian.');
  });

  it('swaps only when the stored value is the one it read', async () => {
    const { db } = await makeAutoWorld();
    await writeRunGuidance({ db, workspaceId, agentId: FIRST, text: 'Keep the diff small.' });
    const stored = (await getWorkspaceValue({ db, workspaceId, key: 'run.guidance' })) ?? '';
    const other = JSON.stringify({ agents: { [FIRST]: 'Keep the diff small.', [SECOND]: 'x' } });
    const select = vi.spyOn(db, 'select');
    select.mockResolvedValueOnce([{ value: stored }]);
    await setWorkspaceValue({ db, workspaceId, key: 'run.guidance', value: other });

    await writeRunGuidance({ db, workspaceId, agentId: FIRST, text: 'Reply in Italian.' });
    select.mockRestore();

    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBe('Reply in Italian.');
    expect(await readRunGuidance({ db, workspaceId, agentId: SECOND })).toBe('x');
  });

  it('keeps the old text and says so when the write fails', async () => {
    const { db } = await makeAutoWorld();
    await writeRunGuidance({ db, workspaceId, agentId: FIRST, text: 'Keep the diff small.' });
    const execute = vi.spyOn(db, 'execute').mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(
      writeRunGuidance({ db, workspaceId, agentId: FIRST, text: 'Reply in Italian.' }),
    ).rejects.toThrow('disk unavailable');
    execute.mockRestore();

    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBe('Keep the diff small.');
  });

  it('ignores a stored value that is not guidance', async () => {
    const { db } = await makeAutoWorld();
    await setWorkspaceValue({ db, workspaceId, key: 'run.guidance', value: 'not json' });

    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBeNull();
    await writeRunGuidance({ db, workspaceId, agentId: FIRST, text: 'Keep the diff small.' });
    expect(await readRunGuidance({ db, workspaceId, agentId: FIRST })).toBe('Keep the diff small.');
  });
});
