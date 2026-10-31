import type {
  AgentRole,
  EffortLevel,
  ModelPrice,
  PlanChangeRequest,
  ProviderId,
  RunRouteCloseness,
  WorkflowTaskDifficulty,
  WorkflowTaskType,
} from '@goodboy/types';

export type OrchestratorStep = {
  readonly name: string;
  readonly role: AgentRole;
  readonly promptPrefix: string;
  readonly expectedOutput?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly effort?: EffortLevel;
  readonly taskType?: WorkflowTaskType;
  readonly difficulty?: WorkflowTaskDifficulty;
  readonly modelReason?: string;
  readonly presetStep?: number;
  readonly mountId?: string;
};

type OrchestratorPresetInput = {
  readonly name: string;
  readonly closeness: RunRouteCloseness;
  readonly steps: ReadonlyArray<
    Readonly<{ name: string; role: string | null; instructions: string; isPinned: boolean }>
  >;
  readonly changes: ReadonlyArray<PlanChangeRequest>;
};

export type RunSummary =
  | {
      readonly kind: 'structured';
      readonly done: ReadonlyArray<string>;
      readonly left: ReadonlyArray<string>;
      readonly leftRoles: Readonly<Partial<Record<string, AgentRole>>>;
    }
  | {
      readonly kind: 'text';
      readonly text: string;
    };

export type OrchestratorDecision =
  | {
      readonly action: 'next';
      readonly reason: string;
      readonly runSummary?: RunSummary;
      readonly change?: PlanChangeRequest;
      readonly step: OrchestratorStep;
    }
  | {
      readonly action: 'done';
      readonly reason: string;
      readonly runSummary?: RunSummary;
      readonly change?: PlanChangeRequest;
    }
  | {
      readonly action: 'blocked';
      readonly reason: string;
      readonly runSummary?: RunSummary;
    };

export type OrchestratorCompletedStep = {
  readonly name: string;
  readonly outputSummary?: string;
};

export type OrchestratorModelOption = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly label: string;
  readonly efforts: ReadonlyArray<EffortLevel>;
  readonly taskTypes: ReadonlyArray<WorkflowTaskType>;
  readonly preferredDifficulty: ReadonlyArray<WorkflowTaskDifficulty>;
  readonly contextWindow: number;
  readonly price: ModelPrice | null;
};

export type OrchestratorRoleDefault = {
  readonly role: AgentRole;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly models?: ReadonlyArray<Readonly<{ provider: ProviderId; model: string }>>;
  readonly skippedPin?: string;
};

type OrchestratorMount = {
  readonly id: string;
  readonly name: string;
  readonly branch?: string;
};

export type OrchestratorInput = {
  readonly mounts?: ReadonlyArray<OrchestratorMount>;
  readonly goal: string;
  readonly processText: string;
  readonly completedSteps: ReadonlyArray<OrchestratorCompletedStep>;
  readonly openQuestionCount: number;
  readonly operatorHints?: string;
  readonly canReadFiles?: boolean;
  readonly decisions?: string;
  readonly providerId: ProviderId;
  readonly modelMenu: ReadonlyArray<OrchestratorModelOption>;
  readonly roleDefaults: ReadonlyArray<OrchestratorRoleDefault>;
  readonly stepsUsed: number;
  readonly isModelMetadataEnabled?: boolean;
  readonly isModelPickEnabled?: boolean;
  readonly spendLimitUsd?: number;
  readonly spentUsd?: number;
  readonly preset?: OrchestratorPresetInput;
};
