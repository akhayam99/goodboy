import { describe, expect, it } from 'vitest';
import { AUTO_DEFAULT_TREE_CAP_USD } from '@goodboy/core';
import { getAutoTreeByRootAgent } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId } from '@goodboy/types';
import { startAutoTrees } from './startAutoTrees';
import { makeDeliveryWorld } from './testing/deliveryWorld';

const AUTO_AGENT = brandId<AgentId>({ value: 'agent-auto-2' });

const worldWithAutoAgent = async () => {
  const state = await makeDeliveryWorld({ agentIds: ['agent-auto-2'] });
  await state.world.db.execute(`UPDATE agents SET kind = 'auto' WHERE id = ?`, [AUTO_AGENT]);
  return state;
};

const treeOf = async (state: Awaited<ReturnType<typeof worldWithAutoAgent>>) =>
  getAutoTreeByRootAgent({ db: state.world.db, rootAgentId: AUTO_AGENT });

describe('starting the tree of an Auto agent', () => {
  it('caps it at the budget of the session before anything else', async () => {
    const state = await worldWithAutoAgent();

    const created = await startAutoTrees({
      ctx: state.ctx,
      sessionCapUsd: ({ sessionId }) => (sessionId === AUTO_SEED_SESSION ? 25 : null),
      workspaceLimitUsd: async () => 8,
    });

    expect(created).toBe(1);
    expect(await treeOf(state)).toMatchObject({
      capUsd: 25,
      sessionId: AUTO_SEED_SESSION,
      primaryMountId: 'mount-ledger-core',
    });
  });

  it('uses the spend cap of the workspace without a session budget, then the default', async () => {
    const withLimit = await worldWithAutoAgent();
    await startAutoTrees({
      ctx: withLimit.ctx,
      sessionCapUsd: () => null,
      workspaceLimitUsd: async () => 8,
    });
    expect((await treeOf(withLimit))?.capUsd).toBe(8);

    const bare = await worldWithAutoAgent();
    await startAutoTrees({
      ctx: bare.ctx,
      sessionCapUsd: () => null,
      workspaceLimitUsd: async () => null,
    });
    expect((await treeOf(bare))?.capUsd).toBe(AUTO_DEFAULT_TREE_CAP_USD);
  });

  it('starts one tree per Auto agent, once, and leaves the other agents alone', async () => {
    const state = await worldWithAutoAgent();
    const params = {
      ctx: state.ctx,
      sessionCapUsd: () => null,
      workspaceLimitUsd: async () => null,
    };

    expect(await startAutoTrees(params)).toBe(1);
    expect(await startAutoTrees(params)).toBe(0);
    const rows = await state.world.db.select<{ readonly n: number }>(
      'SELECT COUNT(*) AS n FROM auto_trees',
    );
    expect(rows[0]?.n).toBe(2);
  });

  it('gives the tree a wall clock and no mount when the session has none it can use', async () => {
    const state = await worldWithAutoAgent();
    state.ports.setMounts([]);

    await startAutoTrees({
      ctx: state.ctx,
      sessionCapUsd: () => null,
      workspaceLimitUsd: async () => null,
    });

    const tree = await treeOf(state);
    expect(tree?.primaryMountId).toBeNull();
    expect((tree?.hardDeadlineAt ?? 0) > state.world.clock.now()).toBe(true);
  });
});
