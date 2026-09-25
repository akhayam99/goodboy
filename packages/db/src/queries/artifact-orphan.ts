import type { ArtifactId, ArtifactKind, IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

export type OrphanArtifactRow = {
  readonly id: ArtifactId;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: number;
  readonly openedAt: number | null;
  readonly keptAt: number | null;
  readonly keptUntil: number | null;
  readonly sessionId: SessionId;
  readonly sessionGoal: string;
  readonly deletedAt: number;
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly workspaceSlug: string;
};

type OrphanArtifactSqlRow = Omit<OrphanArtifactRow, 'createdAt' | 'kind'> & {
  readonly createdAt: number;
  readonly kind: string;
};

type DbParams = {
  readonly db: Database;
};

type ArtifactParams = DbParams & {
  readonly artifactId: ArtifactId;
};

const isKind = (value: string): value is ArtifactKind =>
  value === 'plan' || value === 'report' || value === 'wireframe';

export const listOrphanArtifacts = async ({
  db,
}: DbParams): Promise<ReadonlyArray<OrphanArtifactRow>> => {
  const rows = await db.select<OrphanArtifactSqlRow>(
    `SELECT a.id AS id, a.kind AS kind, a.title AS title, a.revision AS revision,
            a.created_at AS createdAt, a.updated_at AS updatedAt, a.opened_at AS openedAt,
            a.kept_at AS keptAt, a.kept_until AS keptUntil, s.id AS sessionId,
            s.goal AS sessionGoal, s.deleted_at AS deletedAt, w.id AS workspaceId,
            w.name AS workspaceName, w.slug AS workspaceSlug
     FROM session_artifacts a
     JOIN sessions s ON s.id = a.session_id
     JOIN workspaces w ON w.id = s.workspace_id
     WHERE s.deleted_at IS NOT NULL
     ORDER BY s.deleted_at ASC, a.created_at ASC, a.id ASC`,
    [],
  );
  return rows.flatMap((row) =>
    isKind(row.kind)
      ? [
          {
            ...row,
            kind: row.kind,
            createdAt: new Date(row.createdAt).toISOString() as IsoDateTime,
          },
        ]
      : [],
  );
};

export const markArtifactOpened = async ({
  db,
  artifactId,
  openedAt,
}: ArtifactParams & { readonly openedAt: number }): Promise<void> => {
  await db.execute('UPDATE session_artifacts SET opened_at = ? WHERE id = ?', [
    openedAt,
    artifactId,
  ]);
};

export const setArtifactKeep = async ({
  db,
  artifactId,
  keptAt,
  keptUntil,
}: ArtifactParams & {
  readonly keptAt: number | null;
  readonly keptUntil: number | null;
}): Promise<void> => {
  await db.execute('UPDATE session_artifacts SET kept_at = ?, kept_until = ? WHERE id = ?', [
    keptAt,
    keptUntil,
    artifactId,
  ]);
};

export const purgeOrphanArtifact = async ({ db, artifactId }: ArtifactParams): Promise<void> => {
  await db.transaction({
    statements: [
      {
        sql: `DELETE FROM artifact_provenance
              WHERE agent_id = (
                  SELECT a.agent_id FROM session_artifacts a
                  JOIN sessions s ON s.id = a.session_id
                  WHERE a.id = ? AND s.deleted_at IS NOT NULL
                )
                AND NOT EXISTS (
                  SELECT 1 FROM session_artifacts other
                  WHERE other.agent_id = artifact_provenance.agent_id AND other.id <> ?
                )`,
        params: [artifactId, artifactId],
      },
      {
        sql: `DELETE FROM session_artifacts
              WHERE id = ?
                AND session_id IN (SELECT id FROM sessions WHERE deleted_at IS NOT NULL)`,
        params: [artifactId],
      },
    ],
  });
};
