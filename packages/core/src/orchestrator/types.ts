import type { AgentRole, ModelEffort, ProviderId } from '@goodboy/types';

export type OrchestratorStep = {
  readonly name: string;
  readonly role: AgentRole;
  readonly promptPrefix: string;
  readonly expectedOutput?: string;
  readonly model?: string;
  readonly effort?: ModelEffort;
};

export type OrchestratorDecision =
  | {
      readonly action: 'next';
      readonly reason: string;
      readonly runSummary?: string;
      readonly step: OrchestratorStep;
    }
  | {
      readonly action: 'done';
      readonly reason: string;
      readonly runSummary?: string;
    }
  | {
      readonly action: 'blocked';
      readonly reason: string;
      readonly runSummary?: string;
    };

export type OrchestratorCompletedStep = {
  readonly name: string;
  readonly outputSummary?: string;
};

export type OrchestratorModelOption = {
  readonly id: string;
  readonly label: string;
  readonly note: string;
};

export type OrchestratorRoleDefault = {
  readonly role: AgentRole;
  readonly model: string;
  readonly effort: ModelEffort;
};

export type OrchestratorInput = {
  readonly goal: string;
  readonly processText: string;
  readonly completedSteps: ReadonlyArray<OrchestratorCompletedStep>;
  readonly openQuestionCount: number;
  readonly operatorHints?: string;
  readonly providerId: ProviderId;
  readonly modelMenu: ReadonlyArray<OrchestratorModelOption>;
  readonly roleDefaults: ReadonlyArray<OrchestratorRoleDefault>;
  readonly stepsUsed: number;
  readonly spendLimitUsd?: number;
  readonly spentUsd?: number;
};
