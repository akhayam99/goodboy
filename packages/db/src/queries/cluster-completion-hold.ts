import type {
  AgentId,
  ClusterCompletionFinding,
  ClusterCompletionFindingTarget,
  ClusterCompletionHold,
  ClusterCompletionHoldReason,
  ClusterCompletionHoldState,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

type ClusterCompletionHoldRow = {
  readonly id: string;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly container_agent_id: AgentId;
  readonly source_agent_id: AgentId;
  readonly source_turn_id: string;
  readonly reason: ClusterCompletionHoldReason;
  readonly findings_json: string;
  readonly state: ClusterCompletionHoldState;
  readonly resolution_evidence: string | null;
  readonly resolved_at: number | null;
  readonly created_at: number;
  readonly updated_at: number;
};

type RecordClusterCompletionHoldParams = {
  readonly db: Database;
  readonly hold: Readonly<{
    id: string;
    sessionId: SessionId;
    workflowRunId: WorkflowRunId | null;
    containerAgentId: AgentId;
    sourceAgentId: AgentId;
    sourceTurnId: string;
    reason: ClusterCompletionHoldReason;
    findings: ReadonlyArray<ClusterCompletionFinding>;
  }>;
};

type ListClusterCompletionHoldsParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

type ResolveClusterCompletionHoldParams = {
  readonly db: Database;
  readonly id: string;
  readonly resolutionEvidence: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFindingTarget = (value: unknown): value is ClusterCompletionFindingTarget =>
  value === 'implementer' || value === 'planner' || value === 'investigator' || value === 'tester';

const parseFindings = ({
  value,
}: {
  readonly value: string;
}): ReadonlyArray<ClusterCompletionFinding> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const findings: ClusterCompletionFinding[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry) || typeof entry.reason !== 'string' || !isFindingTarget(entry.target)) {
      continue;
    }
    findings.push({ reason: entry.reason, target: entry.target });
  }
  return findings;
};

const toDomain = ({ row }: { readonly row: ClusterCompletionHoldRow }): ClusterCompletionHold => ({
  id: row.id,
  sessionId: row.session_id,
  workflowRunId: row.workflow_run_id,
  containerAgentId: row.container_agent_id,
  sourceAgentId: row.source_agent_id,
  sourceTurnId: row.source_turn_id,
  reason: row.reason,
  findings: parseFindings({ value: row.findings_json }),
  state: row.state,
  resolutionEvidence: row.resolution_evidence,
  resolvedAt: row.resolved_at === null ? null : new Date(row.resolved_at).toISOString(),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const recordClusterCompletionHold = async ({
  db,
  hold,
}: RecordClusterCompletionHoldParams): Promise<ClusterCompletionHold> => {
  const now = Date.now();
  await db.execute(
    `INSERT OR IGNORE INTO cluster_completion_holds
       (id, session_id, workflow_run_id, container_agent_id, source_agent_id, source_turn_id,
        reason, findings_json, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    [
      hold.id,
      hold.sessionId,
      hold.workflowRunId,
      hold.containerAgentId,
      hold.sourceAgentId,
      hold.sourceTurnId,
      hold.reason,
      JSON.stringify(hold.findings),
      now,
      now,
    ],
  );
  const rows = await db.select<ClusterCompletionHoldRow>(
    'SELECT * FROM cluster_completion_holds WHERE source_agent_id = ? AND source_turn_id = ?',
    [hold.sourceAgentId, hold.sourceTurnId],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error('cluster completion hold was not recorded');
  }
  return toDomain({ row });
};

export const listClusterCompletionHolds = async ({
  db,
  sessionId,
}: ListClusterCompletionHoldsParams): Promise<ReadonlyArray<ClusterCompletionHold>> => {
  const rows = await db.select<ClusterCompletionHoldRow>(
    'SELECT * FROM cluster_completion_holds WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows.map((row) => toDomain({ row }));
};

export const resolveClusterCompletionHold = async ({
  db,
  id,
  resolutionEvidence,
}: ResolveClusterCompletionHoldParams): Promise<void> => {
  const evidence = resolutionEvidence.trim();
  if (evidence.length === 0) {
    throw new Error('cluster completion hold resolution requires evidence');
  }
  const now = Date.now();
  await db.execute(
    `UPDATE cluster_completion_holds
        SET state = 'resolved', resolution_evidence = ?, resolved_at = ?, updated_at = ?
      WHERE id = ? AND state = 'open'`,
    [evidence, now, now, id],
  );
};
