import type {
  ProviderId,
  SessionId,
  WorkflowId,
  EffortLevel,
  WorkspaceId,
  WorkflowAutonomy,
  AgentRole,
} from '@goodboy/types';
import type { PlannerOutput } from '@goodboy/core';
import type { WorkflowDraft } from '../../../features/workflows/engine';

export type { SetFn } from '../../slice-types';

export type Mode = 'preset' | 'custom' | 'dynamic';

export type KickoffLane = 'workflow' | 'task';

export type KickoffDraftKey = `kickoff:${WorkspaceId}` | `kickoff-task:${WorkspaceId}`;

export type WorkflowDraftKey = SessionId | KickoffDraftKey;

type OrchestratorModelDraft = {
  readonly providerOverride: ProviderId | '';
  readonly modelOverride: string;
  readonly effortOverride: EffortLevel | null;
};

export type WorkflowBuilderDraft = {
  readonly mode: Mode;
  readonly goalText: string;
  readonly goalHistory: ReadonlyArray<string>;
  readonly selectedPresetId: WorkflowId | null;
  readonly basePresetId: WorkflowId | null;
  readonly processText: string;
  readonly guidance?: string;
  readonly guidanceRoles?: ReadonlyArray<AgentRole>;
  readonly plan: PlannerOutput | null;
  readonly workflow: WorkflowDraft;
  readonly saveAsPreset: boolean;
  readonly autoRun: boolean;
  readonly autonomy?: WorkflowAutonomy;
  readonly title: string;
  readonly orchestratorModel: OrchestratorModelDraft;
  readonly providerPool: ReadonlyArray<ProviderId> | null;
};
