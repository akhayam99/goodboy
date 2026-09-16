import type { Agent } from '@goodboy/types';

export type ArtifactCtaBlockReason = 'no-evidence' | 'run-active' | 'session-busy';

export type ArtifactCtaState =
  Readonly<{ kind: 'ready' }> | Readonly<{ kind: 'blocked'; reason: ArtifactCtaBlockReason }>;

export type ArtifactEvidenceParams = Readonly<{
  agents: ReadonlyArray<Agent>;
}>;

export type ArtifactCtaParams = Readonly<{
  agents: ReadonlyArray<Agent>;
  runAgents: ReadonlyArray<Agent> | null;
  hasSourceActiveTurn: boolean;
  hasSessionActiveTurn: boolean;
  isSummarizerRunning: boolean;
}>;

export const ARTIFACT_CTA_BLOCK_COPY: Record<ArtifactCtaBlockReason, string> = {
  'no-evidence': 'nothing has run yet, so there is nothing to work from',
  'run-active': 'the run is still going, finish it first',
  'session-busy': 'the session is busy, wait for it to settle',
};

export const hasArtifactEvidence = ({ agents }: ArtifactEvidenceParams): boolean =>
  agents.some(
    (agent) =>
      agent.status === 'completed' ||
      agent.status === 'failed' ||
      (agent.outputSummary?.trim().length ?? 0) > 0,
  );

export const resolveArtifactCtaState = ({
  agents,
  runAgents,
  hasSourceActiveTurn,
  hasSessionActiveTurn,
  isSummarizerRunning,
}: ArtifactCtaParams): ArtifactCtaState => {
  const source = runAgents ?? agents;
  if (source.some((agent) => agent.status === 'running') || hasSourceActiveTurn) {
    return { kind: 'blocked', reason: 'run-active' };
  }
  if (
    agents.some((agent) => agent.status === 'running') ||
    hasSessionActiveTurn ||
    isSummarizerRunning
  ) {
    return { kind: 'blocked', reason: 'session-busy' };
  }
  if (hasArtifactEvidence({ agents: source }) === false) {
    return { kind: 'blocked', reason: 'no-evidence' };
  }
  return { kind: 'ready' };
};
