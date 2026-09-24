import type { ProviderId, WorkflowId, EffortLevel } from '@goodboy/types';
import type { PlannerOutput } from '@goodboy/core';
import type { WorkflowDraft } from '../../../features/workflows/engine';

export type { SetFn, GetFn } from '../../slice-types';

export type Mode = 'preset' | 'custom' | 'dynamic';

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
  readonly plan: PlannerOutput | null;
  readonly workflow: WorkflowDraft;
  readonly saveAsPreset: boolean;
  readonly autoRun: boolean;
  readonly title: string;
  readonly orchestratorModel: OrchestratorModelDraft;
};
