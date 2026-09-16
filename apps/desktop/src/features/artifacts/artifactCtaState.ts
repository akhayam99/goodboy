import type { Agent } from '@goodboy/types';

export type ArtifactCtaBlockReason = 'no-evidence' | 'run-active' | 'session-busy';

export type ArtifactCtaState =
  Readonly<{ kind: 'ready' }> | Readonly<{ kind: 'blocked'; reason: ArtifactCtaBlockReason }>;

export type ArtifactCtaParams = Readonly<{
  agents: ReadonlyArray<Agent>;
  runAgents: ReadonlyArray<Agent> | null;
  isTurnRunning: boolean;
  isSummarizerRunning: boolean;
}>;

export const ARTIFACT_CTA_BLOCK_COPY: Record<ArtifactCtaBlockReason, string> = {
  'no-evidence': 'nothing has run yet, so there is nothing to work from',
  'run-active': 'the run is still going, finish it first',
  'session-busy': 'the session is busy, wait for it to settle',
};

const isLive = (agent: Agent): boolean => agent.status === 'pending' || agent.status === 'running';

export const resolveArtifactCtaState = ({
  agents,
  runAgents,
  isTurnRunning,
  isSummarizerRunning,
}: ArtifactCtaParams): ArtifactCtaState => {
  const source = runAgents ?? agents;
  if (source.length === 0) {
    return { kind: 'blocked', reason: 'no-evidence' };
  }
  if (source.some(isLive)) {
    return { kind: 'blocked', reason: 'run-active' };
  }
  if (agents.some(isLive) || isTurnRunning || isSummarizerRunning) {
    return { kind: 'blocked', reason: 'session-busy' };
  }
  return { kind: 'ready' };
};
