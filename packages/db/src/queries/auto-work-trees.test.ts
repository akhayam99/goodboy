import { describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  WORK_SEED_OTHER_WORKSPACE,
  WORK_SEED_WORKSPACE,
  seedWorkWorld,
  type WorkSeedSession,
} from '../test-helpers/auto-work-seeds';
import { listAutoWorkTreesOfWorkspace } from './auto-work-trees';

const workspace = brandId<WorkspaceId>({ value: WORK_SEED_WORKSPACE });

const SESSIONS: ReadonlyArray<WorkSeedSession> = [
  {
    id: 'session-ledger-core',
    workspaceId: WORK_SEED_WORKSPACE,
    goal: 'ship ledger-core',
    mounts: [
      { id: 'mount-a', branch: 'hl/idempotency' },
      { id: 'mount-b', branch: 'hl/retries' },
    ],
    treeId: 'tree-a',
    rootAgentId: 'agent-root-a',
    primaryMountId: 'mount-a',
    delegatedMountIds: ['mount-a', 'mount-b'],
  },
  {
    id: 'session-payments-api',
    workspaceId: WORK_SEED_WORKSPACE,
    goal: 'harden payments-api',
    mounts: [{ id: 'mount-c', branch: 'main' }],
    treeId: 'tree-b',
    rootAgentId: 'agent-root-b',
    primaryMountId: 'mount-c',
    delegatedMountIds: [],
  },
  {
    id: 'session-notify-relay',
    workspaceId: WORK_SEED_WORKSPACE,
    goal: 'fix notify-relay',
    mounts: [{ id: 'mount-d', branch: 'hl/digest' }],
    treeId: 'tree-c',
    rootAgentId: 'agent-root-c',
    primaryMountId: 'mount-d',
    delegatedMountIds: [],
  },
  {
    id: 'session-acme',
    workspaceId: WORK_SEED_OTHER_WORKSPACE,
    goal: 'acme work',
    mounts: [{ id: 'mount-e', branch: 'main' }],
    treeId: 'tree-d',
    rootAgentId: 'agent-root-d',
    primaryMountId: 'mount-e',
    delegatedMountIds: [],
  },
];

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedWorkWorld({ db, sessions: SESSIONS });
  return db;
};

describe('listAutoWorkTreesOfWorkspace', () => {
  it('reads the Leads of three sessions and leaves out another workspace', async () => {
    const db = await world();

    const trees = await listAutoWorkTreesOfWorkspace({ db, workspaceId: workspace });

    expect(trees.map((tree) => tree.treeId)).toEqual(['tree-a', 'tree-b', 'tree-c']);
    expect(trees.map((tree) => tree.sessionGoal)).toEqual([
      'ship ledger-core',
      'harden payments-api',
      'fix notify-relay',
    ]);
  });

  it('lists a Lead on two branches once, with each branch once', async () => {
    const db = await world();

    const trees = await listAutoWorkTreesOfWorkspace({ db, workspaceId: workspace });

    expect(trees[0]?.branches).toEqual(['hl/idempotency', 'hl/retries']);
    expect(trees[1]?.branches).toEqual(['main']);
  });

  it('leaves out a deleted or archived session', async () => {
    const db = await world();
    await db.execute("UPDATE sessions SET deleted_at = 1 WHERE id = 'session-payments-api'");
    await db.execute("UPDATE sessions SET archived_at = 1 WHERE id = 'session-notify-relay'");

    const trees = await listAutoWorkTreesOfWorkspace({ db, workspaceId: workspace });

    expect(trees.map((tree) => tree.treeId)).toEqual(['tree-a']);
  });
});
