import type {
  AgentRole,
  ProviderId,
  StepDefId,
  StepId,
  VerbosityLevel,
  WorkflowOrigin,
} from '@goodboy/types';
import type { EffortLevel } from '../../chat/utils/chat-constants';

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
