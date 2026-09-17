import type { AgentId, ProviderRunId, SessionArtifact } from '@goodboy/types';

type Params = Readonly<{
  artifacts: ReadonlyArray<SessionArtifact>;
  agentId: AgentId | null;
  runId: ProviderRunId | null;
  artifactKind: string;
}>;

const KINDS = new Set(['plan', 'report', 'wireframe']);

const isLive = (artifact: SessionArtifact): boolean => artifact.status !== 'discarded';

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
