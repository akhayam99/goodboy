import { hasBlockingQuestion, type ArtifactCaptureResult } from '@goodboy/core';
import type { Agent, AgentId, ArtifactKind, SessionArtifact } from '@goodboy/types';
import type { AgentKind } from '../session/agent-kind';

export type TurnArtifactOutcome = 'captured' | 'missing' | 'not-expected';

export const MISSING_ARTIFACT_CODE = 'missing';

export const MISSING_ARTIFACT_MESSAGE =
  'the turn ended without an artifact block, so nothing was captured';

const ARTIFACT_KINDS: ReadonlySet<AgentKind> = new Set<AgentKind>(['report', 'wireframe']);

const EXPECTED_ARTIFACT: Partial<Record<AgentKind, ArtifactKind>> = {
  report: 'report',
  wireframe: 'wireframe',
  planner: 'plan',
};

export const expectsArtifact = ({ kind }: { readonly kind: AgentKind | null }): boolean =>
  kind !== null && EXPECTED_ARTIFACT[kind] !== undefined;

type HasArtifactParams = {
  readonly artifacts: ReadonlyArray<SessionArtifact> | undefined;
  readonly agentId: AgentId;
};

export const agentHasArtifact = ({ artifacts, agentId }: HasArtifactParams): boolean =>
  (artifacts ?? []).some((artifact) => artifact.agentId === agentId);

type OutcomeParams = {
  readonly kind: AgentKind | null;
  readonly captured: ArtifactCaptureResult;
  readonly assistantText: string;
  readonly hasPriorArtifact: boolean;
};

export const turnArtifactOutcome = ({
  kind,
  captured,
  assistantText,
  hasPriorArtifact,
}: OutcomeParams): TurnArtifactOutcome => {
  if (kind === null || !expectsArtifact({ kind })) {
    return 'not-expected';
  }
  if (hasBlockingQuestion({ assistantText })) {
    return 'not-expected';
  }
  if (captured.status === 'captured') {
    return captured.artifact.kind === EXPECTED_ARTIFACT[kind] ? 'captured' : 'not-expected';
  }
  if (captured.status === 'error') {
    return 'missing';
  }
  if (!ARTIFACT_KINDS.has(kind) || hasPriorArtifact) {
    return 'not-expected';
  }
  return 'missing';
};

type MissingParams = {
  readonly agent: Agent;
  readonly kind: AgentKind | null;
  readonly artifacts: ReadonlyArray<SessionArtifact> | undefined;
};

export const isAgentMissingArtifact = ({ agent, kind, artifacts }: MissingParams): boolean =>
  agent.status === 'blocked' &&
  kind !== null &&
  ARTIFACT_KINDS.has(kind) &&
  !agentHasArtifact({ artifacts, agentId: agent.id });
