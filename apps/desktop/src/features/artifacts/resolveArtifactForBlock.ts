import type { AgentId, ProviderRunId, SessionArtifact } from '@goodboy/types';

type Params = Readonly<{
  artifacts: ReadonlyArray<SessionArtifact>;
  agentId: AgentId | null;
  runId: ProviderRunId | null;
  artifactKind: string;
}>;

const KINDS = new Set(['plan', 'report', 'wireframe']);

export const resolveArtifactForBlock = ({
  artifacts,
  agentId,
  runId,
  artifactKind,
}: Params): SessionArtifact | null => {
  if (!KINDS.has(artifactKind)) {
    return null;
  }
  const direct =
    runId === null
      ? null
      : (artifacts.find(
          (artifact) => artifact.sourceTurnId === runId && artifact.kind === artifactKind,
        ) ?? null);
  if (direct !== null) {
    return direct;
  }
  if (agentId === null || artifactKind === 'plan') {
    return null;
  }
  return (
    [...artifacts]
      .reverse()
      .find(
        (artifact) =>
          artifact.agentId === agentId &&
          artifact.kind === artifactKind &&
          artifact.status !== 'discarded',
      ) ?? null
  );
};
