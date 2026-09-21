import type {
  Agent,
  AgentId,
  ArtifactKind,
  IsoDateTime,
  OpenQuestion,
  ProviderId,
  SessionArtifact,
} from '@goodboy/types';
import { ARTIFACT_KIND_LABEL } from './artifact-status';
import {
  hasLiveWireframeScout,
  wireframeScoutProgress,
  type WireframeScoutProgress,
  type WireframeScoutVerification,
} from '../wireframes/wireframeScoutProgress';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const ARTIFACT_FILTERS = ['all', 'plan', 'report', 'wireframe'] as const;

export type ArtifactFilter = (typeof ARTIFACT_FILTERS)[number];

export const ARTIFACT_FILTER_LABEL: Record<ArtifactFilter, string> = {
  all: 'All',
  ...ARTIFACT_KIND_LABEL,
};

export type GeneratedArtifactKind = Exclude<ArtifactKind, 'plan'>;

export const GENERATED_ARTIFACT_KINDS: ReadonlyArray<GeneratedArtifactKind> = [
  'report',
  'wireframe',
];

export type ArtifactGenerationState = 'generating' | 'waiting' | 'unproduced';

export type ArtifactGeneration = Readonly<{
  agentId: AgentId;
  kind: GeneratedArtifactKind;
  title: string;
  state: ArtifactGenerationState;
  startedAt: IsoDateTime | null;
  provider: ProviderId | null;
  model: string | null;
  isTurnRunning: boolean;
  scouts: ReadonlyArray<WireframeScoutProgress>;
  canStop: boolean;
}>;

const GENERATING: StatePresentation = {
  label: 'generating',
  reason: 'the agent is still working on it',
  tone: 'info',
  icon: CONCEPT_ICONS.runPending,
};

const WAITING: StatePresentation = {
  label: 'needs you',
  reason: 'the agent stopped on a question it cannot answer for you',
  tone: 'warning',
  icon: CONCEPT_ICONS.questions,
};

export const ARTIFACT_GENERATION_PRESENTATION: Record<
  GeneratedArtifactKind,
  Record<ArtifactGenerationState, StatePresentation>
> = {
  report: {
    generating: GENERATING,
    waiting: WAITING,
    unproduced: {
      label: 'no report produced',
      reason: 'the turn ended without a report to read',
      tone: 'warning',
      icon: CONCEPT_ICONS.runFailed,
    },
  },
  wireframe: {
    generating: GENERATING,
    waiting: WAITING,
    unproduced: {
      label: 'wireframe could not be read',
      reason: 'the turn ended without a wireframe to read',
      tone: 'warning',
      icon: CONCEPT_ICONS.runFailed,
    },
  },
};

type KindParams = Readonly<{ agent: Agent }>;

const generatedKindOf = ({ agent }: KindParams): GeneratedArtifactKind | null =>
  GENERATED_ARTIFACT_KINDS.find((kind) => kind === agent.kind) ?? null;

type ProgressParams = Readonly<{
  agent: Agent;
  activeAgentIds: ReadonlySet<AgentId>;
}>;

const isGenerating = ({ agent, activeAgentIds }: ProgressParams): boolean => {
  if (agent.status === 'running' || activeAgentIds.has(agent.id)) {
    return true;
  }
  return agent.status === 'pending' && agent.lastFinishedAt == null;
};

type WaitingParams = Readonly<{
  agent: Agent;
  openQuestions: ReadonlyArray<OpenQuestion>;
}>;

const isWaitingOnUser = ({ agent, openQuestions }: WaitingParams): boolean =>
  openQuestions.some(
    (question) => question.status === 'open' && question.createdByAgentId === agent.id,
  );

const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

export type ArtifactGenerationsParams = Readonly<{
  agents: ReadonlyArray<Agent>;
  artifacts: ReadonlyArray<SessionArtifact>;
  activeAgentIds: ReadonlySet<AgentId>;
  runningAgentIds: ReadonlySet<AgentId>;
  openQuestions?: ReadonlyArray<OpenQuestion>;
  verifications?: Readonly<Record<string, WireframeScoutVerification>>;
}>;

export const resolveArtifactGenerations = ({
  agents,
  artifacts,
  activeAgentIds,
  runningAgentIds,
  openQuestions = NO_QUESTIONS,
  verifications = {},
}: ArtifactGenerationsParams): ReadonlyArray<ArtifactGeneration> => {
  const produced = new Set(artifacts.map((artifact) => artifact.agentId));
  const rows: Array<ArtifactGeneration> = [];
  for (const agent of agents) {
    const kind = generatedKindOf({ agent });
    if (kind === null || agent.deletedAt != null || produced.has(agent.id)) {
      continue;
    }
    const scouts =
      kind === 'wireframe'
        ? wireframeScoutProgress({ container: agent, agents, runningAgentIds, verifications })
        : [];
    rows.push({
      agentId: agent.id,
      kind,
      title: agent.name,
      state: isGenerating({ agent, activeAgentIds })
        ? 'generating'
        : isWaitingOnUser({ agent, openQuestions })
          ? 'waiting'
          : 'unproduced',
      startedAt: agent.startedAt ?? null,
      provider: agent.providerOverride ?? null,
      model: agent.modelOverride ?? null,
      isTurnRunning: runningAgentIds.has(agent.id),
      scouts,
      canStop: runningAgentIds.has(agent.id) || hasLiveWireframeScout({ scouts }),
    });
  }
  return rows;
};
