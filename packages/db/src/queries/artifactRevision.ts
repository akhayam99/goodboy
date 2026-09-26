import type { ArtifactId, IsoDateTime } from '@goodboy/types';
import type { Database, PlainStatement } from '../client';

export const ARTIFACT_REVISION_AUTHORS = ['agent', 'user', 'import', 'restore'] as const;

export type ArtifactRevisionAuthor = (typeof ARTIFACT_REVISION_AUTHORS)[number];

export type ArtifactRevisionPinnedNode = Readonly<{
  nodeId: string;
  label: string;
}>;

export type ArtifactRevisionPin = Readonly<{
  scope: 'screen' | 'all';
  screenId: string | null;
  nodes: ReadonlyArray<ArtifactRevisionPinnedNode>;
}>;

export type ArtifactRevisionSummary = Readonly<Record<string, number>>;

export type ArtifactRevisionNote = Readonly<{
  author: ArtifactRevisionAuthor;
  ask?: string | null;
  pinned?: ArtifactRevisionPin | null;
  summary?: ArtifactRevisionSummary | null;
}>;

export type ArtifactRevision = Readonly<{
  artifactId: ArtifactId;
  revision: number;
  title: string;
  sourceText: string;
  metadata: Readonly<Record<string, unknown>>;
  author: ArtifactRevisionAuthor;
  ask: string | null;
  pinned: ArtifactRevisionPin | null;
  summary: ArtifactRevisionSummary | null;
  createdAt: IsoDateTime;
}>;

type RevisionRow = {
  readonly artifact_id: string;
  readonly revision: number;
  readonly title: string;
  readonly source_text: string;
  readonly metadata_json: string;
  readonly author: string;
  readonly ask: string | null;
  readonly pinned_json: string | null;
  readonly summary_json: string | null;
  readonly created_at: number;
};

const REVISION_SELECT = `SELECT artifact_id, revision, title, source_text, metadata_json, author,
  ask, pinned_json, summary_json, created_at FROM artifact_revisions`;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJson = ({ text }: { readonly text: string | null }): unknown => {
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const asAuthor = ({ value }: { readonly value: string }): ArtifactRevisionAuthor =>
  ARTIFACT_REVISION_AUTHORS.find((author) => author === value) ?? 'agent';

const asPin = ({ value }: { readonly value: unknown }): ArtifactRevisionPin | null => {
  if (!isRecord(value) || !Array.isArray(value['nodes'])) {
    return null;
  }
  const nodes = value['nodes'].flatMap((node: unknown) =>
    isRecord(node) && typeof node['nodeId'] === 'string' && typeof node['label'] === 'string'
      ? [{ nodeId: node['nodeId'], label: node['label'] }]
      : [],
  );
  return {
    scope: value['scope'] === 'all' ? 'all' : 'screen',
    screenId: typeof value['screenId'] === 'string' ? value['screenId'] : null,
    nodes,
  };
};

const asSummary = ({ value }: { readonly value: unknown }): ArtifactRevisionSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  );
};

const toRevision = ({ row }: { readonly row: RevisionRow }): ArtifactRevision => {
  const metadata = parseJson({ text: row.metadata_json });
  return {
    artifactId: row.artifact_id as ArtifactId,
    revision: row.revision,
    title: row.title,
    sourceText: row.source_text,
    metadata: isRecord(metadata) ? metadata : {},
    author: asAuthor({ value: row.author }),
    ask: row.ask,
    pinned: asPin({ value: parseJson({ text: row.pinned_json }) }),
    summary: asSummary({ value: parseJson({ text: row.summary_json }) }),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
};

type RevisionWriteParams = {
  readonly artifactId: ArtifactId;
  readonly title: string;
  readonly sourceText: string;
  readonly metadataJson: string;
  readonly note: ArtifactRevisionNote;
  readonly createdAt: number;
};

export const artifactRevisionInsert = ({
  artifactId,
  title,
  sourceText,
  metadataJson,
  note,
  createdAt,
}: RevisionWriteParams): PlainStatement => ({
  sql: `INSERT OR REPLACE INTO artifact_revisions (
      artifact_id, revision, title, source_text, metadata_json, author, ask,
      pinned_json, summary_json, created_at
    )
    SELECT id, revision, ?, ?, ?, ?, ?, ?, ?, ? FROM session_artifacts WHERE id = ?`,
  params: [
    title,
    sourceText,
    metadataJson,
    note.author,
    note.ask ?? null,
    note.pinned === undefined || note.pinned === null ? null : JSON.stringify(note.pinned),
    note.summary === undefined || note.summary === null ? null : JSON.stringify(note.summary),
    createdAt,
    artifactId,
  ],
});

export const listArtifactRevisions = async ({
  db,
  artifactId,
}: {
  readonly db: Database;
  readonly artifactId: ArtifactId;
}): Promise<ReadonlyArray<ArtifactRevision>> => {
  const rows = await db.select<RevisionRow>(
    `${REVISION_SELECT} WHERE artifact_id = ? ORDER BY revision DESC`,
    [artifactId],
  );
  return rows.map((row) => toRevision({ row }));
};

export const loadArtifactRevision = async ({
  db,
  artifactId,
  revision,
}: {
  readonly db: Database;
  readonly artifactId: ArtifactId;
  readonly revision: number;
}): Promise<ArtifactRevision | null> => {
  const rows = await db.select<RevisionRow>(
    `${REVISION_SELECT} WHERE artifact_id = ? AND revision = ?`,
    [artifactId, revision],
  );
  const row = rows[0];
  return row === undefined ? null : toRevision({ row });
};

export const annotateArtifactRevision = async ({
  db,
  artifactId,
  revision,
  note,
}: {
  readonly db: Database;
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly note: ArtifactRevisionNote;
}): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE artifact_revisions SET author = ?, ask = ?, pinned_json = ?, summary_json = ?
     WHERE artifact_id = ? AND revision = ?`,
    [
      note.author,
      note.ask ?? null,
      note.pinned === undefined || note.pinned === null ? null : JSON.stringify(note.pinned),
      note.summary === undefined || note.summary === null ? null : JSON.stringify(note.summary),
      artifactId,
      revision,
    ],
  );
  return result.rowsAffected > 0;
};
