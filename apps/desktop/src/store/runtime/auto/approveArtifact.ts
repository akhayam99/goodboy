import type { AutoRefusalCode } from '@goodboy/core';
import { approveAutoArtifact, type Database } from '@goodboy/db';
import type { ArtifactId } from '@goodboy/types';

export type ApproveArtifactParams = Readonly<{
  db: Database;
  artifactId: ArtifactId;
  expectedRevision: number;
}>;

export type ApproveArtifactOutcome =
  | Readonly<{ kind: 'approved'; revision: number }>
  | Readonly<{ kind: 'refused'; code: AutoRefusalCode; latestRevision: number | null }>;

export const approveArtifact = async ({
  db,
  artifactId,
  expectedRevision,
}: ApproveArtifactParams): Promise<ApproveArtifactOutcome> => {
  const outcome = await approveAutoArtifact({ db, artifactId, expectedRevision });
  switch (outcome.kind) {
    case 'approved':
      return { kind: 'approved', revision: outcome.revision };
    case 'unknown':
      return { kind: 'refused', code: 'artifact_unknown', latestRevision: null };
    case 'revising':
      return { kind: 'refused', code: 'artifact_revising', latestRevision: outcome.revision };
    case 'stale_revision':
      return { kind: 'refused', code: 'stale_revision', latestRevision: outcome.revision };
    case 'consumed':
      return { kind: 'refused', code: 'artifact_consumed', latestRevision: outcome.revision };
    case 'discarded':
      return { kind: 'refused', code: 'artifact_discarded', latestRevision: outcome.revision };
    default: {
      const unreachable: never = outcome;
      return unreachable;
    }
  }
};
