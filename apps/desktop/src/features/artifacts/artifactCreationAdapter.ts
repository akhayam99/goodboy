import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import type {
  ArtifactCreationDraft,
  ArtifactCreationRouting,
} from '../../store/slices/artifactDrafts/types';
import type { SpawnReportAgentParams } from '../../store/slices/artifacts/spawnReportAgent';
import type { SpawnWireframeAgentParams } from '../../store/slices/artifacts/spawnWireframeAgent';
import type { GeneratedArtifactKind } from './artifactCollection';

export type ArtifactChoiceOption = Readonly<{
  value: string;
  label: string;
  hint: string;
}>;

export type ArtifactRepoTarget = Readonly<{
  mountName: string;
  branch: string | null;
  baseBranch: string;
}>;

export type ArtifactSpawnActions = Readonly<{
  spawnReportAgent: (params: SpawnReportAgentParams) => Promise<AgentId>;
  spawnWireframeAgent: (params: SpawnWireframeAgentParams) => Promise<AgentId>;
}>;

export type ArtifactCreationAdapter = Readonly<{
  kind: GeneratedArtifactKind;
  crumbLabel: string;
  generateLabel: string;
  ctaTitle: string;
  brief: Readonly<{ label: string; placeholder: string }>;
  choice: Readonly<{
    label: string;
    ariaLabel: string;
    options: ReadonlyArray<ArtifactChoiceOption>;
  }>;
  scopeCopy: Readonly<{ session: string; run: string }>;
  defaultRequest: (params: { readonly choice: string }) => string;
  repoLine: (params: {
    readonly choice: string;
    readonly repo: ArtifactRepoTarget | null;
  }) => string;
  choiceOf: (params: { readonly draft: ArtifactCreationDraft }) => string;
  withChoice: (params: {
    readonly draft: ArtifactCreationDraft;
    readonly choice: string;
  }) => ArtifactCreationDraft;
  resolveRouting: (params: {
    readonly state: AppStore;
    readonly sessionId: SessionId;
    readonly choice: string;
  }) => ArtifactCreationRouting;
  spawn: (params: {
    readonly actions: ArtifactSpawnActions;
    readonly sessionId: SessionId;
    readonly draft: ArtifactCreationDraft;
  }) => Promise<AgentId>;
}>;

export const artifactSpawnScope = ({
  draft,
}: {
  readonly draft: ArtifactCreationDraft;
}): Parameters<ArtifactSpawnActions['spawnReportAgent']>[0]['workflowRunId'] =>
  draft.basedOn.kind === 'workflow-run' ? draft.basedOn.workflowRunId : null;

export const artifactSpawnBrief = ({
  draft,
}: {
  readonly draft: ArtifactCreationDraft;
}): string | null => {
  const trimmed = draft.brief.trim();
  return trimmed.length === 0 ? null : trimmed;
};
