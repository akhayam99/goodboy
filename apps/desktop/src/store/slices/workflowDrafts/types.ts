import type {
  AgentRole,
  ProviderId,
  RoleModelPreferences,
  StepId,
  WorkflowId,
} from '@goodboy/types';
import type { PlannerOutput } from '@goodboy/core';
import type { EffortLevel } from '../../../features/chat/utils/chat-constants';

export type { SetFn, GetFn } from '../../slice-types';

export type Mode = 'preset' | 'custom' | 'dynamic';

export type EditableStep = {
  readonly key: string;
  readonly sourceStepId?: StepId;
  readonly role: AgentRole;
  readonly name: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string;
  readonly providerOverride?: ProviderId;
  readonly modelOverride?: string;
  readonly effort?: EffortLevel;
};

export type WorkflowBuilderDraft = {
  readonly mode: Mode;
  readonly goalText: string;
  readonly goalHistory: ReadonlyArray<string>;
  readonly selectedPresetId: WorkflowId | null;
  readonly basePresetId: WorkflowId | null;
  readonly processText: string;
  readonly plan: PlannerOutput | null;
  readonly steps: ReadonlyArray<EditableStep>;
  readonly saveAsPreset: boolean;
  readonly autoRun: boolean;
  readonly dynamicName: string;
  readonly dynamicNameEdited: boolean;
  readonly roleModelOverrides: RoleModelPreferences;
};
