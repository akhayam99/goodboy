import type {
  AgentId,
  ArtifactId,
  ArtifactKind,
  ArtifactRendition,
  ArtifactSourceFormat,
  ArtifactStatus,
  ImplementationCluster,
  IsoDateTime,
  PlanArtifactMetadata,
  ReportArtifactMetadata,
  SessionArtifact,
  SessionId,
  WireframeArtifactMetadata,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';
import { isWorkflowRoutingProposal } from './workflowRoutingCodec';

type ArtifactRow = {
  readonly id: string;
  readonly session_id: string;
  readonly agent_id: string;
  readonly workflow_run_id: string | null;
  readonly kind: string;
  readonly schema_version: number;
  readonly title: string;
  readonly source_format: string;
  readonly source_text: string;
  readonly metadata_json: string;
  readonly status: string;
  readonly revision: number;
  readonly source_turn_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
};

type RenditionRow = {
  readonly artifact_id: string;
  readonly revision: number;
  readonly format: string;
  readonly renderer_version: string;
  readonly bytes: unknown;
  readonly created_at: number;
};

export type InsertArtifactInput = {
  readonly id: ArtifactId;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly kind: ArtifactKind;
  readonly schemaVersion: number;
  readonly title: string;
  readonly sourceFormat: ArtifactSourceFormat;
  readonly sourceText: string;
  readonly metadata: SessionArtifact['metadata'];
  readonly status?: ArtifactStatus;
  readonly sourceTurnId?: string | null;
};

export type UpdateArtifactSourceInput = {
  readonly id: ArtifactId;
  readonly title: string;
  readonly sourceFormat: ArtifactSourceFormat;
  readonly sourceText: string;
  readonly metadata: SessionArtifact['metadata'];
};

export type PutArtifactRenditionInput = {
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly format: string;
  readonly rendererVersion: string;
  readonly bytes: Uint8Array;
};

export type GetArtifactRenditionInput = {
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly format: string;
  readonly rendererVersion: string;
};

type DatabaseParams = {
  readonly db: Database;
};

type ArtifactIdParams = DatabaseParams & {
  readonly artifactId: ArtifactId;
};

type ArtifactStatusParams = ArtifactIdParams & {
  readonly status: ArtifactStatus;
};

type SessionParams = DatabaseParams & {
  readonly sessionId: SessionId;
};

type RunParams = DatabaseParams & {
  readonly workflowRunId: WorkflowRunId;
};

const ARTIFACT_SELECT = `SELECT id, session_id, agent_id, workflow_run_id, kind,
  schema_version, title, source_format, source_text, metadata_json, status,
  revision, source_turn_id, created_at, updated_at FROM session_artifacts`;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isImplementationCluster = (value: unknown): value is ImplementationCluster => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value['title'] !== 'string' || typeof value['instructions'] !== 'string') {
    return false;
  }
  const proposal = value['routingProposal'];
  if (proposal === undefined || proposal === null) {
    return true;
  }
  return isWorkflowRoutingProposal(proposal);
};

const planMetadataForWrite = (value: unknown): PlanArtifactMetadata => {
  if (!isRecord(value)) {
    throw new Error('Invalid plan artifact metadata');
  }
  const clusters = value['clusters'];
  if (clusters === undefined || clusters === null) {
    return {};
  }
  if (!Array.isArray(clusters)) {
    throw new Error('Invalid plan artifact clusters');
  }
  const valid = clusters.filter(isImplementationCluster);
  if (valid.length !== clusters.length) {
    throw new Error('Invalid implementation cluster routing proposal');
  }
  return valid.length > 0 ? { clusters: valid } : {};
};

const planMetadataForRead = (value: unknown): PlanArtifactMetadata => {
  if (!isRecord(value)) {
    return {};
  }
  const clusters = value['clusters'];
  if (!Array.isArray(clusters)) {
    return {};
  }
  const valid = clusters.filter(isImplementationCluster);
  return valid.length > 0 ? { clusters: valid } : {};
};

const reportMetadata = (value: unknown): ReportArtifactMetadata => {
  if (!isRecord(value) || typeof value['reportType'] !== 'string') {
    throw new Error('Invalid report artifact metadata');
  }
  return { reportType: value['reportType'] };
};

const wireframeMetadata = (value: unknown): WireframeArtifactMetadata => {
  if (!isRecord(value)) {
    throw new Error('Invalid wireframe artifact metadata');
  }
  const fidelity = value['fidelity'];
  const designProfile = value['designProfile'];
  if ((fidelity !== 'low' && fidelity !== 'high') || !isRecord(designProfile)) {
    throw new Error('Invalid wireframe artifact metadata');
  }
  return { fidelity, designProfile };
};

type MetadataParams = {
  readonly kind: ArtifactKind;
  readonly value: unknown;
};

const metadataForWrite = ({ kind, value }: MetadataParams): SessionArtifact['metadata'] => {
  if (kind === 'plan') {
    return planMetadataForWrite(value);
  }
  if (kind === 'report') {
    return reportMetadata(value);
  }
  return wireframeMetadata(value);
};

const metadataForRead = ({ kind, value }: MetadataParams): SessionArtifact['metadata'] => {
  if (kind === 'plan') {
    return planMetadataForRead(value);
  }
  if (kind === 'report') {
    return reportMetadata(value);
  }
  return wireframeMetadata(value);
};

const parseMetadata = ({
  kind,
  value,
}: {
  readonly kind: ArtifactKind;
  readonly value: string;
}) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid artifact metadata JSON');
  }
  return metadataForRead({ kind, value: parsed });
};

const artifactKind = (value: string): ArtifactKind => {
  if (value === 'plan' || value === 'report' || value === 'wireframe') {
    return value;
  }
  throw new Error(`Invalid artifact kind: ${value}`);
};

const artifactStatus = (value: string): ArtifactStatus => {
  if (
    value === 'active' ||
    value === 'consumed' ||
    value === 'superseded' ||
    value === 'discarded'
  ) {
    return value;
  }
  throw new Error(`Invalid artifact status: ${value}`);
};

const toDomain = (row: ArtifactRow): SessionArtifact => {
  const kind = artifactKind(row.kind);
  const common = {
    id: row.id as ArtifactId,
    sessionId: row.session_id as SessionId,
    agentId: row.agent_id as AgentId,
    workflowRunId: row.workflow_run_id === null ? null : (row.workflow_run_id as WorkflowRunId),
    schemaVersion: row.schema_version,
    title: row.title,
    sourceText: row.source_text,
    status: artifactStatus(row.status),
    revision: row.revision,
    sourceTurnId: row.source_turn_id,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
  if (kind === 'plan') {
    if (row.source_format !== 'markdown') {
      throw new Error('Invalid plan artifact source format');
    }
    return {
      ...common,
      kind,
      sourceFormat: row.source_format,
      metadata: parseMetadata({ kind, value: row.metadata_json }) as PlanArtifactMetadata,
    };
  }
  if (kind === 'report') {
    if (row.source_format !== 'markdown') {
      throw new Error('Invalid report artifact source format');
    }
    return {
      ...common,
      kind,
      sourceFormat: row.source_format,
      metadata: parseMetadata({ kind, value: row.metadata_json }) as ReportArtifactMetadata,
    };
  }
  if (row.source_format !== 'json') {
    throw new Error('Invalid wireframe artifact source format');
  }
  return {
    ...common,
    kind,
    sourceFormat: row.source_format,
    metadata: parseMetadata({ kind, value: row.metadata_json }) as WireframeArtifactMetadata,
  };
};

const selectArtifact = async ({
  db,
  artifactId,
}: ArtifactIdParams): Promise<SessionArtifact | null> => {
  const rows = await db.select<ArtifactRow>(`${ARTIFACT_SELECT} WHERE id = ?`, [artifactId]);
  const row = rows[0];
  return row === undefined ? null : toDomain(row);
};

export const insertArtifact = async ({
  db,
  input,
}: DatabaseParams & { readonly input: InsertArtifactInput }): Promise<SessionArtifact> => {
  const metadata = metadataForWrite({ kind: input.kind, value: input.metadata });
  const now = Date.now();
  await db.execute(
    `INSERT INTO session_artifacts (
       id, session_id, agent_id, workflow_run_id, kind, schema_version, title,
       source_format, source_text, metadata_json, status, revision, source_turn_id,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      input.id,
      input.sessionId,
      input.agentId,
      input.workflowRunId ?? null,
      input.kind,
      input.schemaVersion,
      input.title,
      input.sourceFormat,
      input.sourceText,
      JSON.stringify(metadata),
      input.status ?? 'active',
      input.sourceTurnId ?? null,
      now,
      now,
    ],
  );
  const artifact = await selectArtifact({ db, artifactId: input.id });
  if (artifact === null) {
    throw new Error(`Artifact insert failed: ${input.id}`);
  }
  return artifact;
};

export const getArtifact = async ({
  db,
  artifactId,
}: ArtifactIdParams): Promise<SessionArtifact | null> => selectArtifact({ db, artifactId });

export const listArtifactsForSession = async ({
  db,
  sessionId,
}: SessionParams): Promise<ReadonlyArray<SessionArtifact>> => {
  const rows = await db.select<ArtifactRow>(
    `${ARTIFACT_SELECT} WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId],
  );
  return rows.map(toDomain);
};

export const listArtifactsForRun = async ({
  db,
  workflowRunId,
}: RunParams): Promise<ReadonlyArray<SessionArtifact>> => {
  const rows = await db.select<ArtifactRow>(
    `${ARTIFACT_SELECT} WHERE workflow_run_id = ? ORDER BY created_at ASC`,
    [workflowRunId],
  );
  return rows.map(toDomain);
};

export const updateArtifactSource = async ({
  db,
  input,
}: DatabaseParams & { readonly input: UpdateArtifactSourceInput }): Promise<SessionArtifact> => {
  const existing = await selectArtifact({ db, artifactId: input.id });
  if (existing === null) {
    throw new Error(`Artifact not found: ${input.id}`);
  }
  const metadata = metadataForWrite({ kind: existing.kind, value: input.metadata });
  const now = Date.now();
  await db.exec('BEGIN');
  try {
    await db.execute(
      `UPDATE session_artifacts
       SET title = ?, source_format = ?, source_text = ?, metadata_json = ?,
           revision = revision + 1, updated_at = ?
       WHERE id = ?`,
      [input.title, input.sourceFormat, input.sourceText, JSON.stringify(metadata), now, input.id],
    );
    await db.execute('DELETE FROM artifact_renditions WHERE artifact_id = ?', [input.id]);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
  const artifact = await selectArtifact({ db, artifactId: input.id });
  if (artifact === null) {
    throw new Error(`Artifact update failed: ${input.id}`);
  }
  return artifact;
};

export const setArtifactStatus = async ({
  db,
  artifactId,
  status,
}: ArtifactStatusParams): Promise<void> => {
  await db.execute('UPDATE session_artifacts SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    Date.now(),
    artifactId,
  ]);
};

export const deleteArtifact = async ({ db, artifactId }: ArtifactIdParams): Promise<void> => {
  await setArtifactStatus({ db, artifactId, status: 'discarded' });
};

export const restoreArtifact = async ({ db, artifactId }: ArtifactIdParams): Promise<void> => {
  await setArtifactStatus({ db, artifactId, status: 'active' });
};

export const removeArtifact = async ({ db, artifactId }: ArtifactIdParams): Promise<void> => {
  await db.execute('DELETE FROM session_artifacts WHERE id = ?', [artifactId]);
};

const renditionBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
    return Uint8Array.from(value);
  }
  throw new Error('Invalid artifact rendition bytes');
};

const toRendition = (row: RenditionRow): ArtifactRendition => ({
  artifactId: row.artifact_id as ArtifactId,
  revision: row.revision,
  format: row.format,
  rendererVersion: row.renderer_version,
  bytes: renditionBytes(row.bytes),
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

export const putArtifactRendition = async ({
  db,
  input,
}: DatabaseParams & { readonly input: PutArtifactRenditionInput }): Promise<ArtifactRendition> => {
  if (input.bytes.byteLength > 20 * 1024 * 1024) {
    throw new Error('Artifact rendition exceeds 20 MiB');
  }
  const artifact = await selectArtifact({ db, artifactId: input.artifactId });
  if (artifact === null || artifact.revision !== input.revision) {
    throw new Error('Artifact rendition revision is stale');
  }
  const now = Date.now();
  await db.exec('BEGIN');
  try {
    await db.execute('DELETE FROM artifact_renditions WHERE artifact_id = ? AND revision <> ?', [
      input.artifactId,
      input.revision,
    ]);
    await db.execute(
      `INSERT INTO artifact_renditions (
         artifact_id, revision, format, renderer_version, bytes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(artifact_id, revision, format, renderer_version)
       DO UPDATE SET bytes = excluded.bytes, created_at = excluded.created_at`,
      [input.artifactId, input.revision, input.format, input.rendererVersion, input.bytes, now],
    );
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
  return {
    artifactId: input.artifactId,
    revision: input.revision,
    format: input.format,
    rendererVersion: input.rendererVersion,
    bytes: input.bytes,
    createdAt: new Date(now).toISOString() as IsoDateTime,
  };
};

export const getArtifactRendition = async ({
  db,
  input,
}: DatabaseParams & {
  readonly input: GetArtifactRenditionInput;
}): Promise<ArtifactRendition | null> => {
  const rows = await db.select<RenditionRow>(
    `SELECT artifact_id, revision, format, renderer_version, bytes, created_at
     FROM artifact_renditions
     WHERE artifact_id = ? AND revision = ? AND format = ? AND renderer_version = ?`,
    [input.artifactId, input.revision, input.format, input.rendererVersion],
  );
  const row = rows[0];
  return row === undefined ? null : toRendition(row);
};
