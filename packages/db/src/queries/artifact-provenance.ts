import type {
  AgentId,
  ArtifactEvidenceKind,
  ArtifactEvidenceSource,
  ArtifactKind,
  ArtifactProvenance,
  ArtifactRunPhase,
  ArtifactRunTarget,
  ArtifactScoutPlanEntry,
  IsoDateTime,
  MountId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

type ProvenanceRow = {
  readonly agent_id: string;
  readonly session_id: string;
  readonly kind: string;
  readonly brief: string | null;
  readonly evidence_json: string;
  readonly omissions_json: string;
  readonly design_profile_summary: string | null;
  readonly has_design_evidence: number;
  readonly phase: string;
  readonly scout_plan_json: string;
  readonly mount_ids_json: string;
  readonly target: string | null;
  readonly deadline_at: number | null;
  readonly source_workflow_run_id: string | null;
  readonly executing_workflow_run_id: string | null;
  readonly created_at: number;
};

export type PutArtifactProvenanceInput = {
  readonly agentId: AgentId;
  readonly sessionId: SessionId;
  readonly kind: ArtifactKind;
  readonly brief: string | null;
  readonly evidence: ReadonlyArray<ArtifactEvidenceSource>;
  readonly omissions: ReadonlyArray<string>;
  readonly designProfileSummary: string | null;
  readonly hasDesignEvidence: boolean;
  readonly phase: ArtifactRunPhase;
  readonly scoutPlan: ReadonlyArray<ArtifactScoutPlanEntry>;
  readonly mountIds: ReadonlyArray<MountId>;
  readonly target: ArtifactRunTarget | null;
  readonly deadlineAt: number | null;
  readonly sourceWorkflowRunId: WorkflowRunId | null;
  readonly executingWorkflowRunId: WorkflowRunId | null;
};

export type UpdateArtifactRunInput = {
  readonly agentId: AgentId;
  readonly phase: ArtifactRunPhase;
  readonly scoutPlan: ReadonlyArray<ArtifactScoutPlanEntry>;
};

type DatabaseParams = {
  readonly db: Database;
};

const PROVENANCE_SELECT = `SELECT agent_id, session_id, kind, brief, evidence_json,
  omissions_json, design_profile_summary, has_design_evidence, phase, scout_plan_json,
  mount_ids_json, target, deadline_at, source_workflow_run_id,
  executing_workflow_run_id, created_at FROM artifact_provenance`;

const RUN_PHASES: ReadonlyArray<ArtifactRunPhase> = ['gathering', 'producing', 'done', 'failed'];

const RUN_TARGETS: ReadonlyArray<ArtifactRunTarget> = ['mobile', 'desktop', 'both'];

const EVIDENCE_KINDS: ReadonlyArray<ArtifactEvidenceKind> = [
  'session',
  'agent',
  'artifact',
  'workflow-run',
  'unknown',
];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const evidenceKind = (value: unknown): ArtifactEvidenceKind => {
  const match = EVIDENCE_KINDS.find((kind) => kind === value);
  return match ?? 'unknown';
};

const toEvidence = (value: unknown): ReadonlyArray<ArtifactEvidenceSource> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry['id'] !== 'string') {
      return [];
    }
    const label = entry['label'];
    return [
      {
        kind: evidenceKind(entry['kind']),
        id: entry['id'],
        label: typeof label === 'string' ? label : entry['id'],
      },
    ];
  });
};

const toOmissions = (value: unknown): ReadonlyArray<string> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
};

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const artifactKind = (value: string): ArtifactKind => {
  if (value === 'plan' || value === 'report' || value === 'wireframe') {
    return value;
  }
  throw new Error(`Invalid artifact provenance kind: ${value}`);
};

const runPhase = (value: string): ArtifactRunPhase => {
  const match = RUN_PHASES.find((phase) => phase === value);
  if (match === undefined) {
    throw new Error(`Invalid artifact run phase: ${value}`);
  }
  return match;
};

const runTarget = (value: string | null): ArtifactRunTarget | null => {
  if (value === null) {
    return null;
  }
  return RUN_TARGETS.find((target) => target === value) ?? null;
};

const toScoutPlan = (value: unknown): ReadonlyArray<ArtifactScoutPlanEntry> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const roleId = entry['roleId'];
    const mountId = entry['mountId'];
    const reason = entry['reason'];
    const agentId = entry['agentId'];
    if (typeof roleId !== 'string' || typeof mountId !== 'string') {
      return [];
    }
    return [
      {
        roleId,
        mountId: mountId as MountId,
        reason: typeof reason === 'string' ? reason : '',
        agentId: typeof agentId === 'string' ? (agentId as AgentId) : null,
      },
    ];
  });
};

const toMountIds = (value: unknown): ReadonlyArray<MountId> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry as MountId);
};

const toDomain = (row: ProvenanceRow): ArtifactProvenance => ({
  agentId: row.agent_id as AgentId,
  sessionId: row.session_id as SessionId,
  kind: artifactKind(row.kind),
  brief: row.brief,
  evidence: toEvidence(parseJson(row.evidence_json)),
  omissions: toOmissions(parseJson(row.omissions_json)),
  designProfileSummary: row.design_profile_summary,
  hasDesignEvidence: row.has_design_evidence === 1,
  phase: runPhase(row.phase),
  scoutPlan: toScoutPlan(parseJson(row.scout_plan_json)),
  mountIds: toMountIds(parseJson(row.mount_ids_json)),
  target: runTarget(row.target),
  deadlineAt: row.deadline_at,
  sourceWorkflowRunId:
    row.source_workflow_run_id === null ? null : (row.source_workflow_run_id as WorkflowRunId),
  executingWorkflowRunId:
    row.executing_workflow_run_id === null
      ? null
      : (row.executing_workflow_run_id as WorkflowRunId),
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

export const putArtifactProvenance = async ({
  db,
  input,
}: DatabaseParams & { readonly input: PutArtifactProvenanceInput }): Promise<void> => {
  await db.execute(
    `INSERT INTO artifact_provenance (
       agent_id, session_id, kind, brief, evidence_json, omissions_json,
       design_profile_summary, has_design_evidence, phase, scout_plan_json,
       mount_ids_json, target, deadline_at, source_workflow_run_id,
       executing_workflow_run_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       session_id = excluded.session_id,
       kind = excluded.kind,
       brief = excluded.brief,
       evidence_json = excluded.evidence_json,
       omissions_json = excluded.omissions_json,
       design_profile_summary = excluded.design_profile_summary,
       has_design_evidence = excluded.has_design_evidence,
       phase = excluded.phase,
       scout_plan_json = excluded.scout_plan_json,
       mount_ids_json = excluded.mount_ids_json,
       target = excluded.target,
       deadline_at = excluded.deadline_at,
       source_workflow_run_id = excluded.source_workflow_run_id,
       executing_workflow_run_id = excluded.executing_workflow_run_id`,
    [
      input.agentId,
      input.sessionId,
      input.kind,
      input.brief,
      JSON.stringify(input.evidence),
      JSON.stringify(input.omissions),
      input.designProfileSummary,
      input.hasDesignEvidence ? 1 : 0,
      input.phase,
      JSON.stringify(input.scoutPlan),
      JSON.stringify(input.mountIds),
      input.target,
      input.deadlineAt,
      input.sourceWorkflowRunId,
      input.executingWorkflowRunId,
      Date.now(),
    ],
  );
};

export const getArtifactProvenance = async ({
  db,
  agentId,
}: DatabaseParams & { readonly agentId: AgentId }): Promise<ArtifactProvenance | null> => {
  const rows = await db.select<ProvenanceRow>(`${PROVENANCE_SELECT} WHERE agent_id = ?`, [agentId]);
  const row = rows[0];
  return row === undefined ? null : toDomain(row);
};

export const updateArtifactRun = async ({
  db,
  input,
}: DatabaseParams & { readonly input: UpdateArtifactRunInput }): Promise<void> => {
  await db.execute(
    `UPDATE artifact_provenance SET phase = ?, scout_plan_json = ? WHERE agent_id = ?`,
    [input.phase, JSON.stringify(input.scoutPlan), input.agentId],
  );
};
