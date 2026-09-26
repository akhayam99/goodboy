import type {
  AgentId,
  ArtifactId,
  ArtifactKind,
  ArtifactSourceFormat,
  ArtifactStatus,
  SessionArtifact,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  type ArtifactRevision,
  type ArtifactRevisionNote,
  annotateArtifactRevision as dbAnnotateArtifactRevision,
  deleteArtifact as dbDeleteArtifact,
  listArtifactRevisions as dbListArtifactRevisions,
  getArtifactBySourceTurn as dbGetArtifactBySourceTurn,
  insertArtifact as dbInsertArtifact,
  listArtifactsForSession as dbListArtifactsForSession,
  restoreArtifact as dbRestoreArtifact,
  setArtifactStatus as dbSetArtifactStatus,
  updateArtifactSource as dbUpdateArtifactSource,
} from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';

export type CreateArtifactArgs = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly kind: ArtifactKind;
  readonly schemaVersion: number;
  readonly title: string;
  readonly sourceFormat: ArtifactSourceFormat;
  readonly sourceText: string;
  readonly metadata: SessionArtifact['metadata'];
  readonly sourceTurnId: string;
  readonly note?: ArtifactRevisionNote;
};

export const createArtifact = async (args: CreateArtifactArgs): Promise<SessionArtifact> => {
  const replayKey = { agentId: args.agentId, sourceTurnId: args.sourceTurnId };
  const existing = await dbGetArtifactBySourceTurn({ db: tauriDatabase, ...replayKey });
  if (existing !== null) {
    return existing;
  }
  try {
    return await dbInsertArtifact({
      db: tauriDatabase,
      input: {
        id: crypto.randomUUID() as ArtifactId,
        sessionId: args.sessionId,
        agentId: args.agentId,
        workflowRunId: args.workflowRunId ?? null,
        kind: args.kind,
        schemaVersion: args.schemaVersion,
        title: args.title,
        sourceFormat: args.sourceFormat,
        sourceText: args.sourceText,
        metadata: args.metadata,
        sourceTurnId: args.sourceTurnId,
        ...(args.note === undefined ? {} : { note: args.note }),
      },
    });
  } catch (error) {
    const winner = await dbGetArtifactBySourceTurn({ db: tauriDatabase, ...replayKey });
    if (winner === null) {
      throw error;
    }
    return winner;
  }
};

export type UpdateArtifactSourceArgs = {
  readonly artifactId: ArtifactId;
  readonly title: string;
  readonly sourceFormat: ArtifactSourceFormat;
  readonly sourceText: string;
  readonly metadata: SessionArtifact['metadata'];
  readonly note?: ArtifactRevisionNote;
};

export const listArtifactsForSession = async (
  sessionId: SessionId,
): Promise<ReadonlyArray<SessionArtifact>> =>
  dbListArtifactsForSession({ db: tauriDatabase, sessionId });

export const updateArtifactSource = async (
  args: UpdateArtifactSourceArgs,
): Promise<SessionArtifact> =>
  dbUpdateArtifactSource({
    db: tauriDatabase,
    input: {
      id: args.artifactId,
      title: args.title,
      sourceFormat: args.sourceFormat,
      sourceText: args.sourceText,
      metadata: args.metadata,
      ...(args.note === undefined ? {} : { note: args.note }),
    },
  });

export const setArtifactStatus = async (
  artifactId: ArtifactId,
  status: ArtifactStatus,
): Promise<void> => {
  await dbSetArtifactStatus({ db: tauriDatabase, artifactId, status });
};

export const discardArtifact = async (artifactId: ArtifactId): Promise<void> => {
  await dbDeleteArtifact({ db: tauriDatabase, artifactId });
};

export const restoreArtifact = async (artifactId: ArtifactId): Promise<void> => {
  await dbRestoreArtifact({ db: tauriDatabase, artifactId });
};

export const listArtifactRevisions = async (
  artifactId: ArtifactId,
): Promise<ReadonlyArray<ArtifactRevision>> =>
  dbListArtifactRevisions({ db: tauriDatabase, artifactId });

export const annotateArtifactRevision = async ({
  artifactId,
  revision,
  note,
}: {
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly note: ArtifactRevisionNote;
}): Promise<boolean> =>
  dbAnnotateArtifactRevision({ db: tauriDatabase, artifactId, revision, note });
