import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAutoTree,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  purgeAgentForDelete,
  type Database,
} from '@goodboy/db';
import { AUTO_SEED_ROOT } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId } from '@goodboy/types';
import { registerTreeStopPort } from '../../../features/auto/treeStopPort';
import {
  autoDelegates,
  autoTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../../runtime/auto/testing/runtimeWorld';
import { stopAutoTreeForDelete } from './stopAutoTreeForDelete';

const holder: { db: Database | undefined } = vi.hoisted(() => ({ db: undefined }));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: new Proxy(
    {},
    {
      get: (_target, key) => Reflect.get(holder.db ?? {}, key),
    },
  ),
}));

const ROOT = brandId<AgentId>({ value: AUTO_SEED_ROOT });

const TWO_WRITERS = {
  children: [
    { role: 'implementer', task: 'add the export', reason: 'code', mount: 'mount-ledger-core' },
    { role: 'tester', task: 'test the export', reason: 'tests', mount: 'mount-notify-relay' },
  ],
};

let world: RuntimeWorld;

const treeOf = () => getAutoTree({ db: world.state.world.db, treeId: world.treeId });

const wirePort = () => {
  registerTreeStopPort({
    port: async () => {
      const outcome = await world.runtime.stop(world.treeId);
      if (outcome.kind === 'stopping') {
        return 'stuck';
      }
      return outcome.kind === 'idle' && outcome.reason === 'not_owner' ? 'not_owner' : 'stopped';
    },
  });
};

beforeEach(async () => {
  world = await makeRuntimeWorld({ capUsd: 10 });
  holder.db = world.state.world.db;
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  await autoDelegates({ world, spec: TWO_WRITERS });
  await autoTurnEnds({ world });
  wirePort();
});

afterEach(() => {
  registerTreeStopPort({ port: null });
});

describe('deleting the root agent of an Auto tree', () => {
  it('cancels the running children and ends the tree stopped before the agent is purged', async () => {
    const before = await treeOf();

    await stopAutoTreeForDelete({ agentId: ROOT });
    await purgeAgentForDelete({ db: world.state.world.db, id: ROOT });

    expect(world.state.ports.cancels).toHaveLength(2);
    expect(await treeOf()).toMatchObject({
      phase: 'stopped',
      stopState: 'confirmed',
      generation: (before?.generation ?? 0) + 1,
      activeRunId: null,
      blockedReason: null,
    });
    const attempts = await listAutoAttemptsOfTree({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(attempts.map((attempt) => [attempt.state, attempt.outcome])).toEqual([
      ['ended', 'stopped'],
      ['ended', 'stopped'],
    ]);
  });

  it('refuses and leaves the tree unconfirmed when a child does not exit, then finishes on retry', async () => {
    const [first] = await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });
    if (first === undefined) {
      throw new Error('a delegation was expected');
    }
    world.state.ports.setCancelOutcome({ outcome: 'still_running' }, first.childAgentId);

    await expect(stopAutoTreeForDelete({ agentId: ROOT })).rejects.toThrow(
      'Some agents of this Auto tree are still running',
    );
    expect(await treeOf()).toMatchObject({ phase: 'stopping', stopState: 'confirming' });

    world.state.ports.setCancelOutcome({ outcome: 'exited' }, first.childAgentId);
    await stopAutoTreeForDelete({ agentId: ROOT });

    expect(await treeOf()).toMatchObject({ phase: 'stopped', stopState: 'confirmed' });
  });

  it('refuses when another window owns the tree', async () => {
    registerTreeStopPort({ port: async () => 'not_owner' });

    await expect(stopAutoTreeForDelete({ agentId: ROOT })).rejects.toThrow(
      'Another window runs this conversation',
    );
    expect(world.state.ports.cancels).toHaveLength(0);
  });

  it('refuses while Auto is not running, instead of purging a live tree', async () => {
    registerTreeStopPort({ port: null });

    await expect(stopAutoTreeForDelete({ agentId: ROOT })).rejects.toThrow(
      'Auto is not running yet',
    );
    expect((await treeOf())?.phase).not.toBe('stopped');
  });

  it('does nothing for an agent that roots no tree', async () => {
    const stop = vi.fn(async () => 'stopped' as const);
    registerTreeStopPort({ port: stop });

    await stopAutoTreeForDelete({ agentId: brandId<AgentId>({ value: 'agent-harborline' }) });

    expect(stop).not.toHaveBeenCalled();
  });

  it('does nothing for a tree that already finished', async () => {
    const stop = vi.fn(async () => 'stopped' as const);
    registerTreeStopPort({ port: stop });
    await world.state.world.db.execute("UPDATE auto_trees SET phase = 'finished' WHERE id = ?", [
      world.treeId,
    ]);

    await stopAutoTreeForDelete({ agentId: ROOT });

    expect(stop).not.toHaveBeenCalled();
  });
});
