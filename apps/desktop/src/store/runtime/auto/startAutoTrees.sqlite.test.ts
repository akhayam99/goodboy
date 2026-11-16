import { describe, expect, it } from 'vitest';
import { getAutoTreeByRootAgent } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type WorkspaceId } from '@goodboy/types';
import { writeRunLimit } from '../runLimit/writeRunLimit';
import { startAutoTrees } from './startAutoTrees';
import { makeDeliveryWorld } from './testing/deliveryWorld';

const AUTO_AGENT = brandId<AgentId>({ value: 'agent-auto-2' });
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });

const worldWithAutoAgent = async () => {
  const state = await makeDeliveryWorld({ agentIds: ['agent-auto-2'] });
  await state.world.db.execute(`UPDATE agents SET kind = 'auto' WHERE id = ?`, [AUTO_AGENT]);
  return state;
};

const treeOf = async (state: Awaited<ReturnType<typeof worldWithAutoAgent>>) =>
  getAutoTreeByRootAgent({ db: state.world.db, rootAgentId: AUTO_AGENT });

describe('starting the tree of an Auto agent', () => {
  it('caps it at the smallest of the session budget and the workspace Auto limit', async () => {
    const state = await worldWithAutoAgent();

    const created = await startAutoTrees({
      ctx: state.ctx,
      sessionCapUsd: ({ sessionId }) => (sessionId === AUTO_SEED_SESSION ? 25 : null),
      workspaceLimitUsd: async () => 8,
    });

    expect(created).toBe(1);
    expect(await treeOf(state)).toMatchObject({
      capUsd: 8,
      sessionId: AUTO_SEED_SESSION,
      primaryMountId: 'mount-ledger-core',
    });
  });

  it('uses the spend cap of the workspace without a session budget, then no cap', async () => {
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
    expect((await treeOf(bare))?.capUsd).toBeNull();
  });

  it('caps it at the limit picked for the run in place of the workspace default', async () => {
    const picked = await worldWithAutoAgent();
    await writeRunLimit({
      db: picked.world.db,
      workspaceId: WORKSPACE,
      agentId: AUTO_AGENT,
      usd: 3,
    });
    await startAutoTrees({
      ctx: picked.ctx,
      sessionCapUsd: () => null,
      workspaceLimitUsd: async () => 8,
    });
    expect((await treeOf(picked))?.capUsd).toBe(3);

    const kept = await worldWithAutoAgent();
    await startAutoTrees({
      ctx: kept.ctx,
      sessionCapUsd: () => null,
      workspaceLimitUsd: async () => 8,
    });
    expect((await treeOf(kept))?.capUsd).toBe(8);
  });

  it('keeps a lower session budget over the limit picked for the run', async () => {
    const state = await worldWithAutoAgent();
    await writeRunLimit({
      db: state.world.db,
      workspaceId: WORKSPACE,
      agentId: AUTO_AGENT,
      usd: 3,
    });

    await startAutoTrees({
      ctx: state.ctx,
      sessionCapUsd: () => 2,
      workspaceLimitUsd: async () => 8,
    });

    expect((await treeOf(state))?.capUsd).toBe(2);
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
