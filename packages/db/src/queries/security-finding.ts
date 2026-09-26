import type {
  IsoDateTime,
  ProjectId,
  SecretKind,
  SecurityFinding,
  SecurityFindingId,
  SecurityFindingSubjectKind,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type SecurityFindingRow = {
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id: string | null;
  readonly subject_kind: SecurityFindingSubjectKind;
  readonly subject_id: string;
  readonly secret_kind: SecretKind;
  readonly fingerprint: string;
  readonly last4: string;
  readonly first_seen_at: number;
  readonly dismissed_at: number | null;
  readonly resolved_at: number | null;
};

const toDomain = ({ row }: { readonly row: SecurityFindingRow }): SecurityFinding => ({
  id: row.id as SecurityFindingId,
  workspaceId: row.workspace_id as WorkspaceId,
  ...(row.project_id === null ? {} : { projectId: row.project_id as ProjectId }),
  subjectKind: row.subject_kind,
  subjectId: row.subject_id,
  secretKind: row.secret_kind,
  fingerprint: row.fingerprint,
  last4: row.last4,
  firstSeenAt: new Date(row.first_seen_at).toISOString() as IsoDateTime,
  ...(row.dismissed_at === null
    ? {}
    : { dismissedAt: new Date(row.dismissed_at).toISOString() as IsoDateTime }),
  ...(row.resolved_at === null
    ? {}
    : { resolvedAt: new Date(row.resolved_at).toISOString() as IsoDateTime }),
});

type ScannedFinding = {
  readonly secretKind: SecretKind;
  readonly fingerprint: string;
  readonly last4: string;
};

type RecordSecurityFindingsParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly subjectKind: SecurityFindingSubjectKind;
  readonly subjectId: string;
  readonly findings: ReadonlyArray<ScannedFinding>;
  readonly at: IsoDateTime;
};

export const recordSecurityFindings = async ({
  db,
  workspaceId,
  projectId,
  subjectKind,
  subjectId,
  findings,
  at,
}: RecordSecurityFindingsParams): Promise<void> => {
  const timestamp = Date.parse(at);
  const existingRows = await db.select<SecurityFindingRow>(
    'SELECT * FROM security_findings WHERE subject_kind = ? AND subject_id = ?',
    [subjectKind, subjectId],
  );
  const currentFingerprints = new Set(findings.map((finding) => finding.fingerprint));
  const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row]));

  for (const finding of findings) {
    const existing = existingByFingerprint.get(finding.fingerprint);
    if (existing === undefined) {
      await db.execute(
        `INSERT INTO security_findings
          (id, workspace_id, project_id, subject_kind, subject_id, secret_kind, fingerprint, last4, first_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          workspaceId,
          projectId,
          subjectKind,
          subjectId,
          finding.secretKind,
          finding.fingerprint,
          finding.last4,
          timestamp,
        ],
      );
      continue;
    }
    if (existing.resolved_at !== null) {
      await db.execute('UPDATE security_findings SET resolved_at = NULL WHERE id = ?', [
        existing.id,
      ]);
    }
  }

  for (const existing of existingRows) {
    if (existing.resolved_at === null && !currentFingerprints.has(existing.fingerprint)) {
      await db.execute('UPDATE security_findings SET resolved_at = ? WHERE id = ?', [
        timestamp,
        existing.id,
      ]);
    }
  }
};

type ListSecurityFindingsParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listOpenSecurityFindings = async ({
  db,
  workspaceId,
}: ListSecurityFindingsParams): Promise<ReadonlyArray<SecurityFinding>> => {
  const rows = await db.select<SecurityFindingRow>(
    `SELECT * FROM security_findings
     WHERE workspace_id = ? AND dismissed_at IS NULL AND resolved_at IS NULL
     ORDER BY first_seen_at DESC`,
    [workspaceId],
  );
  return rows.map((row) => toDomain({ row }));
};

export const listDismissedSecurityFindings = async ({
  db,
  workspaceId,
}: ListSecurityFindingsParams): Promise<ReadonlyArray<SecurityFinding>> => {
  const rows = await db.select<SecurityFindingRow>(
    `SELECT * FROM security_findings
     WHERE workspace_id = ? AND dismissed_at IS NOT NULL
     ORDER BY dismissed_at DESC`,
    [workspaceId],
  );
  return rows.map((row) => toDomain({ row }));
};

export const countOpenSecurityFindings = async ({
  db,
  workspaceId,
}: ListSecurityFindingsParams): Promise<number> => {
  const rows = await db.select<{ readonly count: number }>(
    `SELECT COUNT(*) AS count FROM security_findings
     WHERE workspace_id = ? AND dismissed_at IS NULL AND resolved_at IS NULL`,
    [workspaceId],
  );
  return rows[0]?.count ?? 0;
};

type FindingTimestampParams = {
  readonly db: Database;
  readonly findingId: SecurityFindingId;
  readonly at: IsoDateTime;
};

export const dismissSecurityFinding = async ({
  db,
  findingId,
  at,
}: FindingTimestampParams): Promise<void> => {
  await db.execute('UPDATE security_findings SET dismissed_at = ? WHERE id = ?', [
    Date.parse(at),
    findingId,
  ]);
};

export const flagSecurityFindingAgain = async ({
  db,
  findingId,
}: {
  readonly db: Database;
  readonly findingId: SecurityFindingId;
}): Promise<void> => {
  await db.execute('UPDATE security_findings SET dismissed_at = NULL WHERE id = ?', [findingId]);
};
