import type { AgentId, ProviderRunId, SessionArtifact } from '@goodboy/types';

type Params = Readonly<{
  artifacts: ReadonlyArray<SessionArtifact>;
  agentId: AgentId | null;
  runId: ProviderRunId | null;
  artifactKind: string;
}>;

const KINDS = new Set(['plan', 'report', 'wireframe']);

const isLive = (artifact: SessionArtifact): boolean => artifact.status !== 'discarded';

type ReplacedParams = Readonly<{
  artifacts: ReadonlyArray<SessionArtifact>;
  agentId: AgentId | null;
  ordinal: number | null;
}>;

export type ReplacedPlan = Readonly<{
  artifact: SessionArtifact;
  version: number;
  latest: number;
}>;

export const resolveReplacedPlan = ({
  artifacts,
  agentId,
  ordinal,
}: ReplacedParams): ReplacedPlan | null => {
  if (agentId === null) {
    return null;
  }
  const reworked = artifacts
    .filter(
      (artifact) =>
        artifact.kind === 'plan' &&
        artifact.agentId === agentId &&
        isLive(artifact) &&
        artifact.revision >= 2,
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (reworked === undefined) {
    return null;
  }
  const version = Math.min(Math.max(ordinal ?? 1, 1), reworked.revision - 1);
  return { artifact: reworked, version, latest: reworked.revision };
};

export const resolveArtifactForBlock = ({
  artifacts,
  agentId,
  runId,
  artifactKind,
}: Params): SessionArtifact | null => {
  if (!KINDS.has(artifactKind)) {
    return null;
  }
  const live = artifacts.filter((artifact) => artifact.kind === artifactKind && isLive(artifact));
  const direct =
    runId === null ? null : (live.find((artifact) => artifact.sourceTurnId === runId) ?? null);
  if (direct !== null) {
    return direct;
  }
  if (agentId === null || artifactKind === 'plan') {
    return null;
  }
  const byAgent = live.filter((artifact) => artifact.agentId === agentId);
  return byAgent.length === 1 ? (byAgent[0] ?? null) : null;
};
