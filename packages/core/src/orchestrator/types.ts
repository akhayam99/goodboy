import type { AgentRole } from '@goodboy/types';

export type OrchestratorStep = {
  readonly name: string;
  readonly role: AgentRole;
  readonly promptPrefix: string;
  readonly expectedOutput?: string;
};

export type OrchestratorDecision =
  | {
      readonly action: 'next';
      readonly reason: string;
      readonly step: OrchestratorStep;
    }
  | {
      readonly action: 'done';
      readonly reason: string;
    }
  | {
      readonly action: 'blocked';
      readonly reason: string;
    };

export type OrchestratorCompletedStep = {
  readonly name: string;
  readonly outputSummary?: string;
};

export type OrchestratorInput = {
  readonly goal: string;
  readonly processText: string;
  readonly completedSteps: ReadonlyArray<OrchestratorCompletedStep>;
  readonly openQuestionCount: number;
};
