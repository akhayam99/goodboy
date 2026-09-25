import type {
  AgentRole,
  ProviderId,
  StepDefId,
  StepId,
  StepSize,
  VerbosityLevel,
  WorkflowOrigin,
  EffortLevel,
} from '@goodboy/types';

export type StepDraft = {
  readonly key: string;
  readonly sourceStepId: StepId | null;
  readonly libraryStepId: StepDefId | null;
  readonly role: AgentRole;
  readonly name: string;
  readonly prompt: string;
  readonly expectedOutput: string;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortLevel;
  readonly verbosity: VerbosityLevel;
  readonly size: StepSize | null;
};

export type WorkflowDraft = {
  readonly name: string;
  readonly description: string;
  readonly goal: string;
  readonly steps: ReadonlyArray<StepDraft>;
  readonly origin: WorkflowOrigin;
  readonly isPreset: boolean;
};

export type WorkflowDraftErrors = {
  readonly name?: string;
  readonly steps?: string;
  readonly stepNames: Readonly<Record<string, string>>;
};
