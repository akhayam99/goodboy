import { setArtifactCommentsStatus, type ArtifactRevision } from '@goodboy/db';
import type { ArtifactComment, ArtifactId, SessionId } from '@goodboy/types';
import { loadArtifactRevision } from '../../../features/artifacts/artifacts';
import { planVersionOfRevision } from '../../../features/plans/planComments/planVersionOfRevision';
import {
  settlePlanComments,
  type CommentSettlement,
  type PlanVersion,
} from '../../../features/plans/planComments/settlePlanComments';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshArtifactComments } from './refresh';
import type { GetFn, SetFn } from './types';

const versionOf = ({
  revision,
}: {
  readonly revision: ArtifactRevision | null;
}): PlanVersion | null => (revision === null ? null : planVersionOfRevision({ revision }));

export const settleAgainstVersions = async ({
  comments,
  before,
  after,
}: {
  readonly comments: ReadonlyArray<ArtifactComment>;
  readonly before: PlanVersion;
  readonly after: PlanVersion;
}): Promise<CommentSettlement> => {
  const settlement = settlePlanComments({ comments, before, after });
  await setArtifactCommentsStatus({
    db: tauriDatabase,
    ids: settlement.addressed,
    status: 'addressed',
  });
  await setArtifactCommentsStatus({ db: tauriDatabase, ids: settlement.open, status: 'open' });
  return settlement;
};

const settleGroup = async ({
  artifactId,
  revision,
  currentRevision,
  comments,
}: {
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly currentRevision: number;
  readonly comments: ReadonlyArray<ArtifactComment>;
}): Promise<void> => {
  if (currentRevision > revision) {
    const before = versionOf({ revision: await loadArtifactRevision({ artifactId, revision }) });
    const after = versionOf({
      revision: await loadArtifactRevision({ artifactId, revision: currentRevision }),
    });
    if (before !== null && after !== null) {
      await settleAgainstVersions({ comments, before, after });
      return;
    }
  }
  await setArtifactCommentsStatus({
    db: tauriDatabase,
    ids: comments.map((comment) => comment.id),
    status: 'open',
  });
};

export const settleStaleSentComments = async ({
  set,
  get,
  sessionId,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
}): Promise<void> => {
  const state = get();
  const stale = (state.artifactComments[sessionId] ?? []).filter(
    (comment) =>
      comment.status === 'sent' && state.artifactCommentSends[comment.artifactId] === undefined,
  );
  if (stale.length === 0) {
    return;
  }
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const artifacts = state.sessionArtifacts[sessionId] ?? [];
  const groups = new Map<string, Array<ArtifactComment>>();
  for (const comment of stale) {
    const artifact = artifacts.find((candidate) => candidate.id === comment.artifactId);
    const planner = agents.find((agent) => agent.id === artifact?.agentId);
    if (artifact === undefined || planner === undefined || planner.status === 'running') {
      continue;
    }
    const key = `${comment.artifactId}:${comment.revision}`;
    groups.set(key, [...(groups.get(key) ?? []), comment]);
  }
  for (const [, comments] of groups) {
    const first = comments[0];
    const artifact = artifacts.find((candidate) => candidate.id === first?.artifactId);
    if (first === undefined || artifact === undefined) {
      continue;
    }
    await settleGroup({
      artifactId: first.artifactId,
      revision: first.revision,
      currentRevision: artifact.revision,
      comments,
    });
  }
  if (groups.size > 0) {
    await refreshArtifactComments({ set, sessionId });
  }
};
