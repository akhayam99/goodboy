import type { Agent, AgentId, ArtifactKind, IsoDateTime, SessionArtifact } from '@goodboy/types';
import { ARTIFACT_KIND_LABEL } from './artifact-status';
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

export type ArtifactGenerationState = 'generating' | 'unproduced';

export type ArtifactGeneration = Readonly<{
  agentId: AgentId;
  kind: GeneratedArtifactKind;
  title: string;
  state: ArtifactGenerationState;
  startedAt: IsoDateTime | null;
}>;

const GENERATING: StatePresentation = {
  label: 'generating',
  reason: 'the agent is still working on it',
  tone: 'info',
  icon: CONCEPT_ICONS.runPending,
};

export const ARTIFACT_GENERATION_PRESENTATION: Record<
  GeneratedArtifactKind,
  Record<ArtifactGenerationState, StatePresentation>
> = {
  report: {
    generating: GENERATING,
    unproduced: {
      label: 'no report produced',
      reason: 'the turn ended without a report to read',
      tone: 'warning',
      icon: CONCEPT_ICONS.runFailed,
    },
  },
  wireframe: {
    generating: GENERATING,
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

export type ArtifactGenerationsParams = Readonly<{
  agents: ReadonlyArray<Agent>;
  artifacts: ReadonlyArray<SessionArtifact>;
  activeAgentIds: ReadonlySet<AgentId>;
}>;

export const resolveArtifactGenerations = ({
  agents,
  artifacts,
  activeAgentIds,
}: ArtifactGenerationsParams): ReadonlyArray<ArtifactGeneration> => {
  const produced = new Set(artifacts.map((artifact) => artifact.agentId));
  const rows: Array<ArtifactGeneration> = [];
  for (const agent of agents) {
    const kind = generatedKindOf({ agent });
    if (kind === null || agent.deletedAt != null || produced.has(agent.id)) {
      continue;
    }
    rows.push({
      agentId: agent.id,
      kind,
      title: agent.name,
      state: isGenerating({ agent, activeAgentIds }) ? 'generating' : 'unproduced',
      startedAt: agent.startedAt ?? null,
    });
  }
  return rows;
};
