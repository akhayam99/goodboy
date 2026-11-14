import { brandId, type AgentId, type AutoTreeId, type SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { insertAutoDelegationStatement } from '../queries/auto-delegations';
import { insertAutoTree } from '../queries/auto-trees';
import { AUTO_SEED_DAY_MS, AUTO_SEED_NOW } from './auto-seeds';

export const WORK_SEED_WORKSPACE = 'workspace-harborline';
export const WORK_SEED_OTHER_WORKSPACE = 'workspace-northwind';

export type WorkSeedSession = Readonly<{
  id: string;
  workspaceId: string;
  goal: string;
  mounts: ReadonlyArray<Readonly<{ id: string; branch: string }>>;
  treeId: string;
  rootAgentId: string;
  primaryMountId: string;
  delegatedMountIds: ReadonlyArray<string>;
}>;

type Params = {
  readonly db: Database;
  readonly sessions: ReadonlyArray<WorkSeedSession>;
};

export const seedWorkWorld = async ({ db, sessions }: Params): Promise<void> => {
  for (const workspace of [WORK_SEED_WORKSPACE, WORK_SEED_OTHER_WORKSPACE]) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspace, workspace, workspace, AUTO_SEED_NOW, AUTO_SEED_NOW],
    );
  }
  for (const session of sessions) {
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [session.id, session.workspaceId, session.goal, 'idle', AUTO_SEED_NOW, AUTO_SEED_NOW],
    );
    for (const mount of session.mounts) {
      await db.execute(
        'INSERT INTO session_worktrees (id, session_id, branch, created_at) VALUES (?, ?, ?, ?)',
        [mount.id, session.id, mount.branch, AUTO_SEED_NOW],
      );
    }
    const agentIds = [
      session.rootAgentId,
      ...session.delegatedMountIds.map((mountId) => `agent-${session.id}-${mountId}`),
    ];
    for (const [ordinal, id] of agentIds.entries()) {
      await db.execute(
        'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)',
        [id, session.id, ordinal, `agent ${id}`, 'pending'],
      );
    }
    await insertAutoTree({
      db,
      tree: {
        id: brandId<AutoTreeId>({ value: session.treeId }),
        rootAgentId: brandId<AgentId>({ value: session.rootAgentId }),
        sessionId: brandId<SessionId>({ value: session.id }),
        primaryMountId: session.primaryMountId,
        capUsd: 5,
        nowMs: AUTO_SEED_NOW,
        hardDeadlineAt: AUTO_SEED_NOW + AUTO_SEED_DAY_MS,
      },
    });
    for (const [slot, mountId] of session.delegatedMountIds.entries()) {
      const statement = insertAutoDelegationStatement({
        delegation: {
          id: brandId({ value: `delegation-${session.id}-${mountId}` }),
          treeId: brandId<AutoTreeId>({ value: session.treeId }),
          generation: 1,
          requestId: brandId({ value: `request-${session.id}-${mountId}` }),
          requestHash: `hash-${session.id}-${mountId}`,
          batchId: brandId({ value: `batch-${session.id}` }),
          slot,
          childAgentId: brandId<AgentId>({ value: `agent-${session.id}-${mountId}` }),
          firstAttemptId: brandId({ value: `attempt-${session.id}-${mountId}` }),
          role: 'implementer',
          request: { task: 'work' },
          target: { mountId },
          routing: {},
          state: 'accepted',
          retryOf: null,
          reviseOf: null,
          baseRevision: null,
          isAdopted: false,
          deadlineAt: AUTO_SEED_NOW + AUTO_SEED_DAY_MS,
          nowMs: AUTO_SEED_NOW,
        },
      });
      await db.execute(statement.sql, statement.params);
    }
  }
};
