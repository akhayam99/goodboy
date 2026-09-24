import { describe, expect, it } from 'vitest';
import type { AgentId, EvidenceEntry, SessionId, WorkflowRunId } from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import {
  latestEvidenceInventory,
  listEvidenceDeliveryReceipts,
  recordEvidenceDelivery,
  recordEvidenceInventory,
} from './evidence-inventory';

const sessionId = 'session' as SessionId;
const workflowRunId = 'run' as WorkflowRunId;
const agentId = 'agent-1' as AgentId;

const entries: ReadonlyArray<EvidenceEntry> = [
  {
    sourceId: 'obligation:o-1',
    kind: 'obligation',
    label: 'implementer for repair',
    provenance: 'capability obligation',
    revision: 'v1',
    availability: 'retrievable',
    detail: 'owner agent-7, running',
  },
];

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Flow', 1, 1)",
  );
  await db.execute(
    "INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at) VALUES ('run', 'session', 'workflow', 0, 0, 1)",
  );
  return db;
};

describe('evidence inventory persistence', () => {
  it('keeps one row per agent and revision and returns the latest', async () => {
    const db = await seed();

    await recordEvidenceInventory({
      db,
      sessionId,
      workflowRunId,
      agentId,
      revision: 'r1',
      entries,
      omittedCount: 0,
    });
    await recordEvidenceInventory({
      db,
      sessionId,
      workflowRunId,
      agentId,
      revision: 'r1',
      entries,
      omittedCount: 0,
    });
    await recordEvidenceInventory({
      db,
      sessionId,
      workflowRunId,
      agentId,
      revision: 'r2',
      entries,
      omittedCount: 2,
    });

    const rows = await db.select<{ readonly total: number }>(
      'SELECT COUNT(*) AS total FROM evidence_inventories',
    );
    expect(rows[0]?.total).toBe(2);

    const latest = await latestEvidenceInventory({ db, agentId });
    expect(latest?.revision).toBe('r2');
    expect(latest?.omittedCount).toBe(2);
    expect(latest?.entries[0]?.sourceId).toBe('obligation:o-1');
  });

  it('records a receipt for what was handed over and for what was refused', async () => {
    const db = await seed();
    await recordEvidenceInventory({
      db,
      sessionId,
      workflowRunId,
      agentId,
      revision: 'r1',
      entries,
      omittedCount: 0,
    });

    await recordEvidenceDelivery({
      db,
      sessionId,
      agentId,
      sourceTurnId: 'turn-1',
      inventoryRevision: 'r1',
      receipts: [
        {
          sourceId: 'obligation:o-1',
          requestedRange: '1-40',
          outcome: 'delivered',
          deliveredChars: 128,
          reason: '',
        },
        {
          sourceId: 'secret:1',
          requestedRange: null,
          outcome: 'unknown-source',
          deliveredChars: 0,
          reason: 'no source with that id is in your inventory',
        },
      ],
    });
    await recordEvidenceDelivery({
      db,
      sessionId,
      agentId,
      sourceTurnId: 'turn-1',
      inventoryRevision: 'r1',
      receipts: [
        {
          sourceId: 'obligation:o-1',
          requestedRange: '1-40',
          outcome: 'delivered',
          deliveredChars: 128,
          reason: '',
        },
      ],
    });

    const receipts = await listEvidenceDeliveryReceipts({ db, agentId });
    expect(receipts).toHaveLength(2);
    expect(receipts.map((receipt) => receipt.outcome).sort()).toEqual([
      'delivered',
      'unknown-source',
    ]);
    expect(receipts.find((receipt) => receipt.outcome === 'delivered')?.deliveredChars).toBe(128);
  });
});
