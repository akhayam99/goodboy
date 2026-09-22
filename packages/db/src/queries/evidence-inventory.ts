import type {
  AgentId,
  ContextReadOutcome,
  EvidenceEntry,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

export type EvidenceInventoryRecord = Readonly<{
  id: string;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  agentId: AgentId;
  revision: string;
  entries: ReadonlyArray<EvidenceEntry>;
  omittedCount: number;
  createdAt: string;
}>;

type InventoryRow = {
  readonly id: string;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly agent_id: AgentId;
  readonly revision: string;
  readonly entries_json: string;
  readonly omitted_count: number;
  readonly created_at: number;
};

const isEvidenceEntry = (value: unknown): value is EvidenceEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate: Record<string, unknown> = { ...value };
  return typeof candidate.sourceId === 'string' && typeof candidate.kind === 'string';
};

const parseEntries = ({ value }: { readonly value: string }): ReadonlyArray<EvidenceEntry> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isEvidenceEntry);
};

const toDomain = ({ row }: { readonly row: InventoryRow }): EvidenceInventoryRecord => ({
  id: row.id,
  sessionId: row.session_id,
  workflowRunId: row.workflow_run_id,
  agentId: row.agent_id,
  revision: row.revision,
  entries: parseEntries({ value: row.entries_json }),
  omittedCount: row.omitted_count,
  createdAt: new Date(row.created_at).toISOString(),
});

export type RecordEvidenceInventoryParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly agentId: AgentId;
  readonly revision: string;
  readonly entries: ReadonlyArray<EvidenceEntry>;
  readonly omittedCount: number;
};

export const recordEvidenceInventory = async ({
  db,
  sessionId,
  workflowRunId,
  agentId,
  revision,
  entries,
  omittedCount,
}: RecordEvidenceInventoryParams): Promise<EvidenceInventoryRecord> => {
  await db.execute(
    `INSERT OR IGNORE INTO evidence_inventories
       (id, session_id, workflow_run_id, agent_id, revision, entries_json, omitted_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `evidence-inventory:${agentId}:${revision}`,
      sessionId,
      workflowRunId,
      agentId,
      revision,
      JSON.stringify(entries),
      omittedCount,
      Date.now(),
    ],
  );
  const rows = await db.select<InventoryRow>(
    'SELECT * FROM evidence_inventories WHERE agent_id = ? AND revision = ?',
    [agentId, revision],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error('evidence inventory was not recorded');
  }
  return toDomain({ row });
};

export const latestEvidenceInventory = async ({
  db,
  agentId,
}: {
  readonly db: Database;
  readonly agentId: AgentId;
}): Promise<EvidenceInventoryRecord | null> => {
  const rows = await db.select<InventoryRow>(
    'SELECT * FROM evidence_inventories WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1',
    [agentId],
  );
  const row = rows[0];
  return row === undefined ? null : toDomain({ row });
};

export type EvidenceDeliveryReceipt = Readonly<{
  id: string;
  sessionId: SessionId;
  agentId: AgentId;
  sourceTurnId: string;
  inventoryRevision: string;
  sourceId: string;
  requestedRange: string | null;
  outcome: ContextReadOutcome;
  deliveredChars: number;
  reason: string;
  createdAt: string;
}>;

type ReceiptRow = {
  readonly id: string;
  readonly session_id: SessionId;
  readonly agent_id: AgentId;
  readonly source_turn_id: string;
  readonly inventory_revision: string;
  readonly source_id: string;
  readonly requested_range: string | null;
  readonly outcome: ContextReadOutcome;
  readonly delivered_chars: number;
  readonly reason: string;
  readonly created_at: number;
};

export type RecordEvidenceDeliveryParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly sourceTurnId: string;
  readonly inventoryRevision: string;
  readonly receipts: ReadonlyArray<
    Readonly<{
      sourceId: string;
      requestedRange: string | null;
      outcome: ContextReadOutcome;
      deliveredChars: number;
      reason: string;
    }>
  >;
};

export const listEvidenceDeliveryReceipts = async ({
  db,
  agentId,
}: {
  readonly db: Database;
  readonly agentId: AgentId;
}): Promise<ReadonlyArray<EvidenceDeliveryReceipt>> => {
  const rows = await db.select<ReceiptRow>(
    'SELECT * FROM evidence_delivery_receipts WHERE agent_id = ? ORDER BY created_at ASC',
    [agentId],
  );
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    agentId: row.agent_id,
    sourceTurnId: row.source_turn_id,
    inventoryRevision: row.inventory_revision,
    sourceId: row.source_id,
    requestedRange: row.requested_range,
    outcome: row.outcome,
    deliveredChars: row.delivered_chars,
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString(),
  }));
};

export const recordEvidenceDelivery = async ({
  db,
  sessionId,
  agentId,
  sourceTurnId,
  inventoryRevision,
  receipts,
}: RecordEvidenceDeliveryParams): Promise<ReadonlyArray<EvidenceDeliveryReceipt>> => {
  const now = Date.now();
  for (const receipt of receipts) {
    await db.execute(
      `INSERT OR IGNORE INTO evidence_delivery_receipts
         (id, session_id, agent_id, source_turn_id, inventory_revision, source_id, requested_range,
          outcome, delivered_chars, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `evidence-receipt:${agentId}:${sourceTurnId}:${receipt.sourceId}`,
        sessionId,
        agentId,
        sourceTurnId,
        inventoryRevision,
        receipt.sourceId,
        receipt.requestedRange,
        receipt.outcome,
        receipt.deliveredChars,
        receipt.reason,
        now,
      ],
    );
  }
  return listEvidenceDeliveryReceipts({ db, agentId });
};
