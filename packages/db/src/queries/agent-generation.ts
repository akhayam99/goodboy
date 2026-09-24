import {
  GENERATION_DEPTH_CAP,
  GENERATION_REPAIR_ATTEMPT_CAP,
  GENERATION_ROOT_DESCENDANT_CAP,
  GENERATION_RUN_CAP,
  GENERATION_STRUCTURAL_REPLAN_CAP,
  type AgentId,
  type GenerationCreationPath,
  type GenerationLimitName,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

const ANCESTRY_WALK_CAP = 64;

type GenerationCounts = Readonly<{
  depth: number;
  rootDescendants: number;
  runDescendants: number;
  obligationAttempts: number;
  runStructuralReplans: number;
}>;

type GenerationVerdict =
  | Readonly<{ kind: 'granted' }>
  | Readonly<{ kind: 'refused'; limit: GenerationLimitName; reason: string }>;

type CheckParams = {
  readonly counts: GenerationCounts;
  readonly count: number;
  readonly purpose: string | null;
  readonly hasObligation: boolean;
};

const checkGenerationLimits = ({
  counts,
  count,
  purpose,
  hasObligation,
}: CheckParams): GenerationVerdict => {
  if (counts.depth > GENERATION_DEPTH_CAP) {
    return {
      kind: 'refused',
      limit: 'depth',
      reason: `capability generation depth ${counts.depth} is past the cap of ${GENERATION_DEPTH_CAP}`,
    };
  }
  if (counts.rootDescendants + count > GENERATION_ROOT_DESCENDANT_CAP) {
    return {
      kind: 'refused',
      limit: 'root-descendants',
      reason: `this causal root already generated ${counts.rootDescendants} of ${GENERATION_ROOT_DESCENDANT_CAP} agents`,
    };
  }
  if (counts.runDescendants + count > GENERATION_RUN_CAP) {
    return {
      kind: 'refused',
      limit: 'run-descendants',
      reason: `this run already generated ${counts.runDescendants} of ${GENERATION_RUN_CAP} agents`,
    };
  }
  if (hasObligation && counts.obligationAttempts + count > GENERATION_REPAIR_ATTEMPT_CAP) {
    return {
      kind: 'refused',
      limit: 'repair-attempts',
      reason: `this obligation already took ${counts.obligationAttempts} of ${GENERATION_REPAIR_ATTEMPT_CAP} automatic attempts`,
    };
  }
  if (
    purpose === 'replan' &&
    counts.runStructuralReplans + count > GENERATION_STRUCTURAL_REPLAN_CAP
  ) {
    return {
      kind: 'refused',
      limit: 'structural-replans',
      reason: `this run already took ${counts.runStructuralReplans} of ${GENERATION_STRUCTURAL_REPLAN_CAP} automatic structural replans`,
    };
  }
  return { kind: 'granted' };
};

export type GenerationReservation = Readonly<{
  reservationId: string;
  depth: number;
  causalRootAgentId: AgentId | null;
}>;

export type GenerationReservationResult =
  | Readonly<{ kind: 'granted'; reservations: ReadonlyArray<GenerationReservation> }>
  | Readonly<{
      kind: 'refused';
      limit: GenerationLimitName;
      reason: string;
      isFirstRefusal: boolean;
    }>;

export type ReserveAgentGenerationParams = {
  readonly db: Database;
  readonly reservationId: string;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly parentAgentId: AgentId | null;
  readonly creationPath: GenerationCreationPath;
  readonly count: number;
  readonly obligationId?: string | null;
  readonly purpose?: string | null;
};

type AgentLineageRow = {
  readonly id: AgentId;
  readonly session_id: SessionId;
  readonly parent_agent_id: AgentId | null;
};

type CountRow = { readonly total: number };

type DepthRow = { readonly depth: number };

type LineageResolution =
  | Readonly<{ kind: 'resolved'; causalRootAgentId: AgentId; parentDepth: number }>
  | Readonly<{ kind: 'invalid'; reason: string }>;

const resolveLineage = async ({
  db,
  sessionId,
  parentAgentId,
}: {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly parentAgentId: AgentId;
}): Promise<LineageResolution> => {
  const seen = new Set<AgentId>();
  let cursor: AgentId = parentAgentId;
  let root: AgentId = parentAgentId;
  let structuralDepth = 0;
  for (let step = 0; step < ANCESTRY_WALK_CAP; step++) {
    if (seen.has(cursor)) {
      return { kind: 'invalid', reason: 'the parent lineage contains a cycle' };
    }
    seen.add(cursor);
    const rows = await db.select<AgentLineageRow>(
      'SELECT id, session_id, parent_agent_id FROM agents WHERE id = ?',
      [cursor],
    );
    const row = rows[0];
    if (row === undefined) {
      return { kind: 'invalid', reason: `ancestor ${cursor} is not on record` };
    }
    if (row.session_id !== sessionId) {
      return { kind: 'invalid', reason: `ancestor ${cursor} belongs to another session` };
    }
    root = row.id;
    if (row.parent_agent_id === null) {
      break;
    }
    cursor = row.parent_agent_id;
    structuralDepth += 1;
    if (step === ANCESTRY_WALK_CAP - 1) {
      return { kind: 'invalid', reason: 'the parent lineage is deeper than the walk cap' };
    }
  }
  const depthRows = await db.select<DepthRow>(
    'SELECT depth FROM agent_generation_ledger WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1',
    [parentAgentId],
  );
  return {
    kind: 'resolved',
    causalRootAgentId: root,
    parentDepth: Math.max(depthRows[0]?.depth ?? 0, structuralDepth),
  };
};

const countOf = async ({
  db,
  sql,
  params,
}: {
  readonly db: Database;
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
}): Promise<number> => {
  const rows = await db.select<CountRow>(sql, params);
  return rows[0]?.total ?? 0;
};

const generationRefusalScope = ({
  parentAgentId,
  workflowRunId,
}: {
  readonly parentAgentId: AgentId | null;
  readonly workflowRunId: WorkflowRunId | null;
}): string => {
  if (parentAgentId !== null) {
    return `agent:${parentAgentId}`;
  }
  if (workflowRunId !== null) {
    return `run:${workflowRunId}`;
  }
  return 'session';
};

const recordRefusal = async ({
  db,
  sessionId,
  workflowRunId,
  parentAgentId,
  causalRootAgentId,
  obligationId,
  limit,
  reason,
}: {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly parentAgentId: AgentId | null;
  readonly causalRootAgentId: AgentId | null;
  readonly obligationId: string | null;
  readonly limit: GenerationLimitName;
  readonly reason: string;
}): Promise<boolean> => {
  const result = await db.execute(
    `INSERT OR IGNORE INTO generation_refusals
       (id, session_id, workflow_run_id, parent_agent_id, scope_key, causal_root_agent_id,
        obligation_id, limit_name, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `generation-refusal:${crypto.randomUUID()}`,
      sessionId,
      workflowRunId,
      parentAgentId,
      generationRefusalScope({ parentAgentId, workflowRunId }),
      causalRootAgentId,
      obligationId,
      limit,
      reason,
      Date.now(),
    ],
  );
  return result.rowsAffected > 0;
};

export const reserveAgentGeneration = async ({
  db,
  reservationId,
  sessionId,
  workflowRunId,
  parentAgentId,
  creationPath,
  count,
  obligationId = null,
  purpose = null,
}: ReserveAgentGenerationParams): Promise<GenerationReservationResult> => {
  const lineage =
    parentAgentId === null
      ? ({ kind: 'resolved', causalRootAgentId: null, parentDepth: -1 } as const)
      : await resolveLineage({ db, sessionId, parentAgentId });
  if (lineage.kind === 'invalid') {
    const isFirstRefusal = await recordRefusal({
      db,
      sessionId,
      workflowRunId,
      parentAgentId,
      causalRootAgentId: null,
      obligationId,
      limit: 'lineage',
      reason: lineage.reason,
    });
    return { kind: 'refused', limit: 'lineage', reason: lineage.reason, isFirstRefusal };
  }
  const depth = lineage.parentDepth + 1;
  const counts: GenerationCounts = {
    depth,
    rootDescendants:
      lineage.causalRootAgentId === null
        ? 0
        : await countOf({
            db,
            sql: 'SELECT COUNT(*) AS total FROM agent_generation_ledger WHERE causal_root_agent_id = ? AND depth > 0',
            params: [lineage.causalRootAgentId],
          }),
    runDescendants:
      workflowRunId === null
        ? 0
        : await countOf({
            db,
            sql: 'SELECT COUNT(*) AS total FROM agent_generation_ledger WHERE workflow_run_id = ?',
            params: [workflowRunId],
          }),
    obligationAttempts:
      obligationId === null
        ? 0
        : await countOf({
            db,
            sql: 'SELECT COUNT(*) AS total FROM agent_generation_ledger WHERE obligation_id = ?',
            params: [obligationId],
          }),
    runStructuralReplans:
      workflowRunId === null
        ? 0
        : await countOf({
            db,
            sql: "SELECT COUNT(*) AS total FROM agent_generation_ledger WHERE workflow_run_id = ? AND purpose = 'replan'",
            params: [workflowRunId],
          }),
  };
  const verdict = checkGenerationLimits({
    counts,
    count,
    purpose,
    hasObligation: obligationId !== null,
  });
  if (verdict.kind === 'refused') {
    const isFirstRefusal = await recordRefusal({
      db,
      sessionId,
      workflowRunId,
      parentAgentId,
      causalRootAgentId: lineage.causalRootAgentId,
      obligationId,
      limit: verdict.limit,
      reason: verdict.reason,
    });
    return { kind: 'refused', limit: verdict.limit, reason: verdict.reason, isFirstRefusal };
  }
  const now = Date.now();
  const attempt = `${reservationId}:${crypto.randomUUID()}`;
  const reservations: GenerationReservation[] = [];
  for (let index = 0; index < count; index++) {
    const id = `${attempt}:${index}`;
    const result = await db.execute(
      `INSERT INTO agent_generation_ledger
         (id, session_id, workflow_run_id, parent_agent_id, causal_root_agent_id, agent_id, depth,
          creation_path, obligation_id, purpose, created_at)
       SELECT ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM agent_generation_ledger WHERE id = ?)
          AND (
            ? IS NULL
            OR (SELECT COUNT(*) FROM agent_generation_ledger WHERE causal_root_agent_id = ? AND depth > 0)
               < ?
          )
          AND (
            ? IS NULL
            OR (SELECT COUNT(*) FROM agent_generation_ledger WHERE workflow_run_id = ?) < ?
          )
          AND (
            ? IS NULL
            OR (SELECT COUNT(*) FROM agent_generation_ledger WHERE obligation_id = ?) < ?
          )
          AND (
            ? IS NULL
            OR ? <> 'replan'
            OR (SELECT COUNT(*) FROM agent_generation_ledger WHERE workflow_run_id = ? AND purpose = 'replan') < ?
          )`,
      [
        id,
        sessionId,
        workflowRunId,
        parentAgentId,
        lineage.causalRootAgentId ?? id,
        depth,
        creationPath,
        obligationId,
        purpose,
        now,
        id,
        lineage.causalRootAgentId,
        lineage.causalRootAgentId,
        GENERATION_ROOT_DESCENDANT_CAP,
        workflowRunId,
        workflowRunId,
        GENERATION_RUN_CAP,
        obligationId,
        obligationId,
        GENERATION_REPAIR_ATTEMPT_CAP,
        workflowRunId,
        purpose,
        workflowRunId,
        GENERATION_STRUCTURAL_REPLAN_CAP,
      ],
    );
    if (result.rowsAffected === 0) {
      const raceReason = 'another path took the remaining generation allowance first';
      const isFirstRefusal = await recordRefusal({
        db,
        sessionId,
        workflowRunId,
        parentAgentId,
        causalRootAgentId: lineage.causalRootAgentId,
        obligationId,
        limit: 'root-descendants',
        reason: raceReason,
      });
      return {
        kind: 'refused',
        limit: 'root-descendants',
        reason: raceReason,
        isFirstRefusal,
      };
    }
    reservations.push({ reservationId: id, depth, causalRootAgentId: lineage.causalRootAgentId });
  }
  return { kind: 'granted', reservations };
};

export type BindAgentGenerationParams = {
  readonly db: Database;
  readonly bindings: ReadonlyArray<Readonly<{ reservationId: string; agentId: AgentId }>>;
};

export const bindAgentGeneration = async ({
  db,
  bindings,
}: BindAgentGenerationParams): Promise<void> => {
  for (const binding of bindings) {
    const result = await db.execute(
      `UPDATE agent_generation_ledger
          SET agent_id = ?,
              causal_root_agent_id = CASE WHEN parent_agent_id IS NULL THEN ? ELSE causal_root_agent_id END
        WHERE id = ? AND agent_id IS NULL`,
      [binding.agentId, binding.agentId, binding.reservationId],
    );
    if (result.rowsAffected === 0) {
      throw new Error(
        `reservation ${binding.reservationId} is missing or already bound to an agent`,
      );
    }
  }
};

export const countObligationAttempts = async ({
  db,
  obligationId,
}: {
  readonly db: Database;
  readonly obligationId: string;
}): Promise<number> => {
  const rows = await db.select<CountRow>(
    'SELECT COUNT(*) AS total FROM agent_generation_ledger WHERE obligation_id = ?',
    [obligationId],
  );
  return rows[0]?.total ?? 0;
};

export type GenerationRefusal = Readonly<{
  id: string;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  parentAgentId: AgentId | null;
  causalRootAgentId: AgentId | null;
  obligationId: string | null;
  limitName: GenerationLimitName;
  reason: string;
  createdAt: string;
}>;

type RefusalRow = {
  readonly id: string;
  readonly session_id: SessionId;
  readonly workflow_run_id: WorkflowRunId | null;
  readonly parent_agent_id: AgentId | null;
  readonly causal_root_agent_id: AgentId | null;
  readonly obligation_id: string | null;
  readonly limit_name: GenerationLimitName;
  readonly reason: string;
  readonly created_at: number;
};

export const listGenerationRefusals = async ({
  db,
  sessionId,
}: {
  readonly db: Database;
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<GenerationRefusal>> => {
  const rows = await db.select<RefusalRow>(
    'SELECT * FROM generation_refusals WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    workflowRunId: row.workflow_run_id,
    parentAgentId: row.parent_agent_id,
    causalRootAgentId: row.causal_root_agent_id,
    obligationId: row.obligation_id,
    limitName: row.limit_name,
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString(),
  }));
};
