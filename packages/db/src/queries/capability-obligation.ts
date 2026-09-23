import type {
  AgentId,
  AgentRole,
  CapabilityContinuation,
  CapabilityGrant,
  CapabilityGrantState,
  CapabilityObligation,
  CapabilityObligationDecision,
  CapabilityObligationState,
  CapabilityParentOutcome,
  CapabilityPurpose,
  CapabilityRequest,
  SessionId,
  WorkflowRoutingProposal,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';
import { isWorkflowRoutingProposal } from './workflowRoutingCodec';

type CapabilityObligationRow = {
  readonly id: string;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly identity: string;
  readonly requester_agent_id: AgentId;
  readonly target_role: AgentRole;
  readonly purpose: CapabilityPurpose;
  readonly state: CapabilityObligationState;
  readonly owner_agent_id: AgentId | null;
  readonly decision: CapabilityObligationDecision | null;
  readonly decision_reason: string | null;
  readonly satisfied_revision: string | null;
  readonly child_agent_id: AgentId | null;
  readonly delivered_at: number | null;
  readonly delivery_receipt: string | null;
  readonly created_at: number;
  readonly updated_at: number;
};

type CapabilityGrantRow = {
  readonly id: string;
  readonly obligation_id: string;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly granted_role: AgentRole;
  readonly purpose: CapabilityPurpose;
  readonly continuation: CapabilityContinuation;
  readonly parent_outcome: CapabilityParentOutcome;
  readonly child_agent_id: AgentId | null;
  readonly replacement_agent_id: AgentId | null;
  readonly verification_agent_id: AgentId | null;
  readonly transferred_work: string | null;
  readonly state: CapabilityGrantState;
  readonly created_at: number;
  readonly updated_at: number;
};

type CapabilityRequestRow = {
  readonly id: string;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly obligation_id: string;
  readonly requester_agent_id: AgentId;
  readonly source_turn_id: string;
  readonly target_role: AgentRole;
  readonly purpose: CapabilityPurpose;
  readonly question: string;
  readonly scope_json: string;
  readonly evidence_json: string;
  readonly gap: string;
  readonly expected_output: string;
  readonly continuation: CapabilityContinuation;
  readonly routing_proposal: string | null;
  readonly inventory_revision: string;
  readonly created_at: number;
};

type HoldLinkRow = {
  readonly obligation_id: string;
  readonly hold_id: string;
};

export type CapabilityNeedRecord = Readonly<{
  requestId: string;
  obligationId: string;
  identity: string;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  requesterAgentId: AgentId;
  sourceTurnId: string;
  targetRole: AgentRole;
  purpose: CapabilityPurpose;
  question: string;
  scope: ReadonlyArray<string>;
  evidenceRefs: ReadonlyArray<string>;
  gap: string;
  expectedOutput: string;
  continuation: CapabilityContinuation;
  routingProposal: WorkflowRoutingProposal | null;
  inventoryRevision: string;
}>;

type RecordCapabilityNeedParams = {
  readonly db: Database;
  readonly need: CapabilityNeedRecord;
};

type AssociateHoldParams = {
  readonly db: Database;
  readonly obligation: Readonly<{
    id: string;
    identity: string;
    sessionId: SessionId;
    workflowRunId: WorkflowRunId | null;
    requesterAgentId: AgentId;
    targetRole: AgentRole;
    purpose: CapabilityPurpose;
  }>;
  readonly holdId: string;
};

type ListCapabilityObligationsParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

const parseStringList = ({ value }: { readonly value: string }): ReadonlyArray<string> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const entries: string[] = [];
  for (const entry of parsed) {
    if (typeof entry === 'string' && entry.length > 0) {
      entries.push(entry);
    }
  }
  return entries;
};

const parseRoutingProposal = ({
  value,
}: {
  readonly value: string | null;
}): WorkflowRoutingProposal | null => {
  if (value === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  return isWorkflowRoutingProposal(parsed) ? parsed : null;
};

const requestToDomain = ({ row }: { readonly row: CapabilityRequestRow }): CapabilityRequest => ({
  id: row.id,
  sessionId: row.session_id,
  workflowRunId: row.workflow_run_id,
  obligationId: row.obligation_id,
  requesterAgentId: row.requester_agent_id,
  sourceTurnId: row.source_turn_id,
  targetRole: row.target_role,
  purpose: row.purpose,
  question: row.question,
  scope: parseStringList({ value: row.scope_json }),
  evidenceRefs: parseStringList({ value: row.evidence_json }),
  gap: row.gap,
  expectedOutput: row.expected_output,
  continuation: row.continuation,
  routingProposal: parseRoutingProposal({ value: row.routing_proposal }),
  inventoryRevision: row.inventory_revision,
  createdAt: new Date(row.created_at).toISOString(),
});

const obligationToDomain = ({
  row,
  requests,
  holdIds,
}: {
  readonly row: CapabilityObligationRow;
  readonly requests: ReadonlyArray<CapabilityRequest>;
  readonly holdIds: ReadonlyArray<string>;
}): CapabilityObligation => ({
  id: row.id,
  sessionId: row.session_id,
  workflowRunId: row.workflow_run_id,
  identity: row.identity,
  requesterAgentId: row.requester_agent_id,
  targetRole: row.target_role,
  purpose: row.purpose,
  state: row.state,
  ownerAgentId: row.owner_agent_id,
  decision: row.decision,
  decisionReason: row.decision_reason,
  satisfiedRevision: row.satisfied_revision,
  childAgentId: row.child_agent_id,
  deliveredAt: row.delivered_at === null ? null : new Date(row.delivered_at).toISOString(),
  deliveryReceipt: row.delivery_receipt,
  requests,
  holdIds,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const obligationByIdentity = async ({
  db,
  identity,
}: {
  readonly db: Database;
  readonly identity: string;
}): Promise<CapabilityObligationRow> => {
  const rows = await db.select<CapabilityObligationRow>(
    'SELECT * FROM capability_obligations WHERE identity = ?',
    [identity],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error('capability obligation was not recorded');
  }
  return row;
};

const insertObligation = async ({
  db,
  obligation,
}: {
  readonly db: Database;
  readonly obligation: AssociateHoldParams['obligation'];
}): Promise<CapabilityObligationRow> => {
  const now = Date.now();
  await db.execute(
    `INSERT OR IGNORE INTO capability_obligations
       (id, session_id, workflow_run_id, identity, requester_agent_id, target_role, purpose,
        state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    [
      obligation.id,
      obligation.sessionId,
      obligation.workflowRunId,
      obligation.identity,
      obligation.requesterAgentId,
      obligation.targetRole,
      obligation.purpose,
      now,
      now,
    ],
  );
  return obligationByIdentity({ db, identity: obligation.identity });
};

export const recordCapabilityNeed = async ({
  db,
  need,
}: RecordCapabilityNeedParams): Promise<CapabilityObligation> => {
  const obligationRow = await insertObligation({
    db,
    obligation: {
      id: need.obligationId,
      identity: need.identity,
      sessionId: need.sessionId,
      workflowRunId: need.workflowRunId,
      requesterAgentId: need.requesterAgentId,
      targetRole: need.targetRole,
      purpose: need.purpose,
    },
  });
  const now = Date.now();
  await db.execute(
    `INSERT OR IGNORE INTO capability_requests
       (id, session_id, workflow_run_id, obligation_id, requester_agent_id, source_turn_id,
        target_role, purpose, question, scope_json, evidence_json, gap, expected_output,
        continuation, routing_proposal, inventory_revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      need.requestId,
      need.sessionId,
      need.workflowRunId,
      obligationRow.id,
      need.requesterAgentId,
      need.sourceTurnId,
      need.targetRole,
      need.purpose,
      need.question,
      JSON.stringify(need.scope),
      JSON.stringify(need.evidenceRefs),
      need.gap,
      need.expectedOutput,
      need.continuation,
      need.routingProposal === null ? null : JSON.stringify(need.routingProposal),
      need.inventoryRevision,
      now,
    ],
  );
  const requests = await db.select<CapabilityRequestRow>(
    'SELECT * FROM capability_requests WHERE obligation_id = ? ORDER BY created_at ASC',
    [obligationRow.id],
  );
  const holds = await db.select<HoldLinkRow>(
    'SELECT obligation_id, hold_id FROM capability_obligation_holds WHERE obligation_id = ?',
    [obligationRow.id],
  );
  return obligationToDomain({
    row: obligationRow,
    requests: requests.map((row) => requestToDomain({ row })),
    holdIds: holds.map((row) => row.hold_id),
  });
};

export const associateCapabilityObligationHold = async ({
  db,
  obligation,
  holdId,
}: AssociateHoldParams): Promise<CapabilityObligation> => {
  const obligationRow = await insertObligation({ db, obligation });
  await db.execute(
    `INSERT OR IGNORE INTO capability_obligation_holds (obligation_id, hold_id, created_at)
     VALUES (?, ?, ?)`,
    [obligationRow.id, holdId, Date.now()],
  );
  const requests = await db.select<CapabilityRequestRow>(
    'SELECT * FROM capability_requests WHERE obligation_id = ? ORDER BY created_at ASC',
    [obligationRow.id],
  );
  const holds = await db.select<HoldLinkRow>(
    'SELECT obligation_id, hold_id FROM capability_obligation_holds WHERE obligation_id = ?',
    [obligationRow.id],
  );
  return obligationToDomain({
    row: obligationRow,
    requests: requests.map((row) => requestToDomain({ row })),
    holdIds: holds.map((row) => row.hold_id),
  });
};

export type ClaimCapabilityObligationOwnerParams = {
  readonly db: Database;
  readonly identity: string;
  readonly ownerAgentId: AgentId;
  readonly childAgentId: AgentId | null;
};

export type CapabilityObligationClaim =
  | Readonly<{ kind: 'owned'; obligationId: string; ownerAgentId: AgentId }>
  | Readonly<{ kind: 'attached'; obligationId: string; ownerAgentId: AgentId }>
  | Readonly<{ kind: 'not-claimable'; obligationId: string; state: CapabilityObligationState }>
  | Readonly<{ kind: 'unknown-obligation' }>;

export const claimCapabilityObligationOwner = async ({
  db,
  identity,
  ownerAgentId,
  childAgentId,
}: ClaimCapabilityObligationOwnerParams): Promise<CapabilityObligationClaim> => {
  const claimed = await db.execute(
    `UPDATE capability_obligations
        SET owner_agent_id = ?, child_agent_id = ?, state = 'granted', decision = 'granted',
            updated_at = ?
      WHERE identity = ?
        AND owner_agent_id IS NULL
        AND state = 'open'
        AND (decision IS NULL OR decision = 'refinement')`,
    [ownerAgentId, childAgentId, Date.now(), identity],
  );
  const rows = await db.select<CapabilityObligationRow>(
    'SELECT * FROM capability_obligations WHERE identity = ?',
    [identity],
  );
  const row = rows[0];
  if (row === undefined) {
    return { kind: 'unknown-obligation' };
  }
  const owner = row.owner_agent_id;
  if (owner === null) {
    return { kind: 'not-claimable', obligationId: row.id, state: row.state };
  }
  if (claimed.rowsAffected > 0) {
    return { kind: 'owned', obligationId: row.id, ownerAgentId: owner };
  }
  await db.execute(
    `UPDATE capability_obligations SET decision = 'attached', updated_at = ?
      WHERE identity = ? AND decision IS NULL`,
    [Date.now(), identity],
  );
  return { kind: 'attached', obligationId: row.id, ownerAgentId: owner };
};

export const listCapabilityObligations = async ({
  db,
  sessionId,
}: ListCapabilityObligationsParams): Promise<ReadonlyArray<CapabilityObligation>> => {
  const rows = await db.select<CapabilityObligationRow>(
    'SELECT * FROM capability_obligations WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  const requests = await db.select<CapabilityRequestRow>(
    'SELECT * FROM capability_requests WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  const holds = await db.select<HoldLinkRow>(
    `SELECT h.obligation_id, h.hold_id
       FROM capability_obligation_holds h
       JOIN capability_obligations o ON o.id = h.obligation_id
      WHERE o.session_id = ?`,
    [sessionId],
  );
  return rows.map((row) =>
    obligationToDomain({
      row,
      requests: requests
        .filter((request) => request.obligation_id === row.id)
        .map((request) => requestToDomain({ row: request })),
      holdIds: holds.filter((link) => link.obligation_id === row.id).map((link) => link.hold_id),
    }),
  );
};

const grantToDomain = ({ row }: { readonly row: CapabilityGrantRow }): CapabilityGrant => ({
  id: row.id,
  obligationId: row.obligation_id,
  sessionId: row.session_id,
  workflowRunId: row.workflow_run_id,
  grantedRole: row.granted_role,
  purpose: row.purpose,
  continuation: row.continuation,
  parentOutcome: row.parent_outcome,
  childAgentId: row.child_agent_id,
  replacementAgentId: row.replacement_agent_id,
  verificationAgentId: row.verification_agent_id,
  transferredWork: row.transferred_work,
  state: row.state,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

type ListCapabilityGrantsParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listCapabilityGrants = async ({
  db,
  sessionId,
}: ListCapabilityGrantsParams): Promise<ReadonlyArray<CapabilityGrant>> => {
  const rows = await db.select<CapabilityGrantRow>(
    'SELECT * FROM capability_grants WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows.map((row) => grantToDomain({ row }));
};

export type ClaimCapabilityGrantParams = {
  readonly db: Database;
  readonly grant: Readonly<{
    id: string;
    obligationId: string;
    sessionId: SessionId;
    workflowRunId: WorkflowRunId | null;
    grantedRole: AgentRole;
    purpose: CapabilityPurpose;
    continuation: CapabilityContinuation;
    parentOutcome: CapabilityParentOutcome;
    transferredWork: string | null;
  }>;
};

export type CapabilityGrantClaim = Readonly<{
  grant: CapabilityGrant;
  isFirstDelivery: boolean;
}>;

export const claimCapabilityGrant = async ({
  db,
  grant,
}: ClaimCapabilityGrantParams): Promise<CapabilityGrantClaim> => {
  const now = Date.now();
  const inserted = await db.execute(
    `INSERT OR IGNORE INTO capability_grants
       (id, obligation_id, session_id, workflow_run_id, granted_role, purpose, continuation,
        parent_outcome, transferred_work, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      grant.id,
      grant.obligationId,
      grant.sessionId,
      grant.workflowRunId,
      grant.grantedRole,
      grant.purpose,
      grant.continuation,
      grant.parentOutcome,
      grant.transferredWork,
      now,
      now,
    ],
  );
  const rows = await db.select<CapabilityGrantRow>(
    'SELECT * FROM capability_grants WHERE obligation_id = ?',
    [grant.obligationId],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error('capability grant was not recorded');
  }
  return { grant: grantToDomain({ row }), isFirstDelivery: inserted.rowsAffected > 0 };
};

export type UpdateCapabilityGrantParams = {
  readonly db: Database;
  readonly obligationId: string;
  readonly state: CapabilityGrantState;
  readonly childAgentId: AgentId | null;
  readonly replacementAgentId: AgentId | null;
  readonly verificationAgentId: AgentId | null;
};

export const updateCapabilityGrant = async ({
  db,
  obligationId,
  state,
  childAgentId,
  replacementAgentId,
  verificationAgentId,
}: UpdateCapabilityGrantParams): Promise<CapabilityGrant | null> => {
  await db.execute(
    `UPDATE capability_grants
        SET state = ?,
            child_agent_id = COALESCE(?, child_agent_id),
            replacement_agent_id = COALESCE(?, replacement_agent_id),
            verification_agent_id = COALESCE(?, verification_agent_id),
            updated_at = ?
      WHERE obligation_id = ?`,
    [state, childAgentId, replacementAgentId, verificationAgentId, Date.now(), obligationId],
  );
  const rows = await db.select<CapabilityGrantRow>(
    'SELECT * FROM capability_grants WHERE obligation_id = ?',
    [obligationId],
  );
  const row = rows[0];
  return row === undefined ? null : grantToDomain({ row });
};

export type DecideCapabilityObligationParams = {
  readonly db: Database;
  readonly obligationId: string;
  readonly decision: CapabilityObligationDecision;
  readonly reason: string;
};

const OBLIGATION_STATE_FOR_DECISION: Readonly<
  Record<CapabilityObligationDecision, CapabilityObligationState>
> = {
  granted: 'granted',
  refused: 'refused',
  attached: 'granted',
  refinement: 'open',
};

export const decideCapabilityObligation = async ({
  db,
  obligationId,
  decision,
  reason,
}: DecideCapabilityObligationParams): Promise<void> => {
  await db.execute(
    `UPDATE capability_obligations
        SET decision = ?, decision_reason = ?, state = ?, updated_at = ?
      WHERE id = ?`,
    [decision, reason, OBLIGATION_STATE_FOR_DECISION[decision], Date.now(), obligationId],
  );
};

export type SettleCapabilityObligationParams = {
  readonly db: Database;
  readonly obligationId: string;
  readonly verifiedRevision: string;
  readonly deliveryReceipt: string;
};

export const settleCapabilityObligation = async ({
  db,
  obligationId,
  verifiedRevision,
  deliveryReceipt,
}: SettleCapabilityObligationParams): Promise<void> => {
  const now = Date.now();
  await db.execute(
    `UPDATE capability_obligations
        SET state = 'satisfied', satisfied_revision = ?, delivery_receipt = ?,
            delivered_at = COALESCE(delivered_at, ?), updated_at = ?
      WHERE id = ? AND state <> 'satisfied'`,
    [verifiedRevision, deliveryReceipt, now, now, obligationId],
  );
  await db.execute(
    `UPDATE capability_grants SET state = 'settled', updated_at = ? WHERE obligation_id = ?`,
    [now, obligationId],
  );
};
