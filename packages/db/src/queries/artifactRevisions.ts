import type { ArtifactId, ArtifactRevision, IsoDateTime, SessionArtifact } from '@goodboy/types';
import type { Database } from '../client';
import { artifactKind, getArtifact, parseArtifactMetadata, updateArtifactSource } from './artifact';

type ArtifactRevisionRow = {
  readonly artifact_id: string;
  readonly revision: number;
  readonly title: string;
  readonly source_text: string;
  readonly metadata_json: string;
  readonly author: string;
  readonly ask: string | null;
  readonly created_at: number;
  readonly kind: string;
};

const REVISION_SELECT = `SELECT ar.artifact_id, ar.revision, ar.title, ar.source_text,
  ar.metadata_json, ar.author, ar.ask, ar.created_at, sa.kind
  FROM artifact_revisions ar
  JOIN session_artifacts sa ON sa.id = ar.artifact_id`;

const isRevisionAuthor = (value: string): value is ArtifactRevision['author'] =>
  value === 'agent' || value === 'user' || value === 'import' || value === 'restore';

const toDomain = (row: ArtifactRevisionRow): ArtifactRevision => {
  const kind = artifactKind(row.kind);
  const author = row.author;
  if (!isRevisionAuthor(author)) {
    throw new Error(`Invalid artifact revision author: ${author}`);
  }
  return {
    artifactId: row.artifact_id as ArtifactId,
    revision: row.revision,
    title: row.title,
    sourceText: row.source_text,
    metadata: parseArtifactMetadata({
      kind,
      value: row.metadata_json,
    }) as SessionArtifact['metadata'],
    author,
    ask: row.ask,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
};

type DatabaseParams = {
  readonly db: Database;
};

export const listArtifactRevisions = async ({
  db,
  artifactId,
}: DatabaseParams & { readonly artifactId: ArtifactId }): Promise<
  ReadonlyArray<ArtifactRevision>
> => {
  const rows = await db.select<ArtifactRevisionRow>(
    `${REVISION_SELECT} WHERE ar.artifact_id = ? ORDER BY ar.revision DESC`,
    [artifactId],
  );
  return rows.map(toDomain);
};

export const loadArtifactRevision = async ({
  db,
  artifactId,
  revision,
}: DatabaseParams & {
  readonly artifactId: ArtifactId;
  readonly revision: number;
}): Promise<ArtifactRevision | null> => {
  const rows = await db.select<ArtifactRevisionRow>(
    `${REVISION_SELECT} WHERE ar.artifact_id = ? AND ar.revision = ?`,
    [artifactId, revision],
  );
  const row = rows[0];
  return row === undefined ? null : toDomain(row);
};

export const restoreArtifactRevision = async ({
  db,
  artifactId,
  revision,
}: DatabaseParams & {
  readonly artifactId: ArtifactId;
  readonly revision: number;
}): Promise<SessionArtifact> => {
  const [existing, target] = await Promise.all([
    getArtifact({ db, artifactId }),
    loadArtifactRevision({ db, artifactId, revision }),
  ]);
  if (existing === null) {
    throw new Error(`Artifact not found: ${artifactId}`);
  }
  if (target === null) {
    throw new Error(`Artifact revision not found: ${artifactId}#${revision}`);
  }
  return updateArtifactSource({
    db,
    input: {
      id: artifactId,
      title: target.title,
      sourceFormat: existing.sourceFormat,
      sourceText: target.sourceText,
      metadata: target.metadata,
      author: 'restore',
    },
  });
};
