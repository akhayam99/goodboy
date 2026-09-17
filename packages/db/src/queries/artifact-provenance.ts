import type {
  AgentId,
  ArtifactEvidenceKind,
  ArtifactEvidenceSource,
  ArtifactKind,
  ArtifactProvenance,
  IsoDateTime,
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
  readonly sourceWorkflowRunId: WorkflowRunId | null;
  readonly executingWorkflowRunId: WorkflowRunId | null;
};

type DatabaseParams = {
  readonly db: Database;
};

const PROVENANCE_SELECT = `SELECT agent_id, session_id, kind, brief, evidence_json,
  omissions_json, design_profile_summary, has_design_evidence, source_workflow_run_id,
  executing_workflow_run_id, created_at FROM artifact_provenance`;

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

const toDomain = (row: ProvenanceRow): ArtifactProvenance => ({
  agentId: row.agent_id as AgentId,
  sessionId: row.session_id as SessionId,
  kind: artifactKind(row.kind),
  brief: row.brief,
  evidence: toEvidence(parseJson(row.evidence_json)),
  omissions: toOmissions(parseJson(row.omissions_json)),
  designProfileSummary: row.design_profile_summary,
  hasDesignEvidence: row.has_design_evidence === 1,
  phase: 'done',
  scoutPlan: [],
  mountIds: [],
  target: null,
  deadlineAt: null,
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
       design_profile_summary, has_design_evidence, source_workflow_run_id,
       executing_workflow_run_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       session_id = excluded.session_id,
       kind = excluded.kind,
       brief = excluded.brief,
       evidence_json = excluded.evidence_json,
       omissions_json = excluded.omissions_json,
       design_profile_summary = excluded.design_profile_summary,
       has_design_evidence = excluded.has_design_evidence,
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
