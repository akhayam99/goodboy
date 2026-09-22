import type {
  AgentRole,
  CapabilityContinuation,
  CapabilityPurpose,
  EvidenceEntry,
  ModelEffort,
  ProviderId,
  WorkflowTaskDifficulty,
  WorkflowTaskType,
} from '@goodboy/types';
import type { ModelPriceSummary } from '../providers/model-price';

export type OrchestratorStep = {
  readonly name: string;
  readonly role: AgentRole;
  readonly promptPrefix: string;
  readonly expectedOutput?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly effort?: ModelEffort;
  readonly taskType?: WorkflowTaskType;
  readonly difficulty?: WorkflowTaskDifficulty;
  readonly modelReason?: string;
};

export type RunSummary =
  | {
      readonly kind: 'structured';
      readonly done: ReadonlyArray<string>;
      readonly left: ReadonlyArray<string>;
    }
  | {
      readonly kind: 'text';
      readonly text: string;
    };

export type OrchestratorNeedDisposition =
  | {
      readonly kind: 'grant';
      readonly step: OrchestratorStep;
    }
  | {
      readonly kind: 'reuse';
      readonly evidenceRefs: ReadonlyArray<string>;
    }
  | {
      readonly kind: 'attach';
    }
  | {
      readonly kind: 'refine';
    }
  | {
      readonly kind: 'refuse';
    };

export type OrchestratorDecision =
  | {
      readonly action: 'next';
      readonly reason: string;
      readonly runSummary?: RunSummary;
      readonly step: OrchestratorStep;
    }
  | {
      readonly action: 'done';
      readonly reason: string;
      readonly runSummary?: RunSummary;
    }
  | {
      readonly action: 'blocked';
      readonly reason: string;
      readonly runSummary?: RunSummary;
    }
  | {
      readonly action: 'need';
      readonly reason: string;
      readonly runSummary?: RunSummary;
      readonly obligationId: string;
      readonly disposition: OrchestratorNeedDisposition;
    };

export type OrchestratorCompletedStep = {
  readonly name: string;
  readonly outputSummary?: string;
};

export type OrchestratorModelOption = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly label: string;
  readonly efforts: ReadonlyArray<ModelEffort>;
  readonly taskTypes: ReadonlyArray<WorkflowTaskType>;
  readonly preferredDifficulty: ReadonlyArray<WorkflowTaskDifficulty>;
  readonly contextWindow: number;
  readonly price: ModelPriceSummary | null;
};

export type OrchestratorRoleDefault = {
  readonly role: AgentRole;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: ModelEffort;
};

export type OrchestratorNeedRequest = {
  readonly obligationId: string;
  readonly requesterName: string;
  readonly requesterRole: AgentRole;
  readonly targetRole: AgentRole;
  readonly purpose: CapabilityPurpose;
  readonly question: string;
  readonly gap: string;
  readonly scope: ReadonlyArray<string>;
  readonly expectedOutput: string;
  readonly continuation: CapabilityContinuation;
  readonly evidenceRefs: ReadonlyArray<string>;
  readonly inventoryRevision: string;
};

export type OrchestratorUnresolvedObligation = {
  readonly obligationId: string;
  readonly identity: string;
  readonly targetRole: AgentRole;
  readonly purpose: CapabilityPurpose;
  readonly state: string;
  readonly ownerName: string | null;
};

export type OrchestratorAllowances = {
  readonly generationRemaining: number;
  readonly repairAttemptsRemaining: number;
  readonly structuralReplansRemaining: number;
  readonly spendRemainingUsd: number | null;
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
  readonly isModelMetadataEnabled?: boolean;
  readonly spendLimitUsd?: number;
  readonly spentUsd?: number;
  readonly pendingRequest?: OrchestratorNeedRequest;
  readonly evidenceExcerpts?: ReadonlyArray<EvidenceEntry>;
  readonly unresolvedObligations?: ReadonlyArray<OrchestratorUnresolvedObligation>;
  readonly graphRevision?: string;
  readonly allowances?: OrchestratorAllowances;
};
