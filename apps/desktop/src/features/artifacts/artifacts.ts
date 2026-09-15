import type {
  ArtifactId,
  ArtifactSourceFormat,
  ArtifactStatus,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import {
  deleteArtifact as dbDeleteArtifact,
  listArtifactsForSession as dbListArtifactsForSession,
  restoreArtifact as dbRestoreArtifact,
  setArtifactStatus as dbSetArtifactStatus,
  updateArtifactSource as dbUpdateArtifactSource,
} from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';

export type UpdateArtifactSourceArgs = {
  readonly artifactId: ArtifactId;
  readonly title: string;
  readonly sourceFormat: ArtifactSourceFormat;
  readonly sourceText: string;
  readonly metadata: SessionArtifact['metadata'];
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
