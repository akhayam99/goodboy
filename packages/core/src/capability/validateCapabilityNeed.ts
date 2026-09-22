import type {
  AgentRole,
  CapabilityPurpose,
  ClusterCompletionFindingTarget,
  ProviderId,
} from '@goodboy/types';
import { extractCapabilityNeed, type ExtractedCapabilityNeed } from '../context/marker-parsing';
import { isDelegationContinuationSupported, isDelegationGranted } from '../roles';

export type CapabilityNeedRejection =
  | 'malformed-body'
  | 'foreign-agent'
  | 'empty-question'
  | 'capability-denied'
  | 'unsupported-continuation';

export type CapabilityNeedValidation =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'rejected'; rejection: CapabilityNeedRejection; reason: string }>
  | Readonly<{ kind: 'valid'; need: ExtractedCapabilityNeed }>;

type ValidateCapabilityNeedParams = {
  readonly assistantText: string;
  readonly emittingProvider: ProviderId | null;
  readonly requesterAgentId: string;
  readonly requesterRole: string;
};

export const validateCapabilityNeed = ({
  assistantText,
  emittingProvider,
  requesterAgentId,
  requesterRole,
}: ValidateCapabilityNeedParams): CapabilityNeedValidation => {
  const extraction = extractCapabilityNeed({ assistantText, emittingProvider });
  if (extraction.kind === 'none') {
    return { kind: 'none' };
  }
  if (extraction.kind === 'malformed') {
    return { kind: 'rejected', rejection: 'malformed-body', reason: extraction.reason };
  }
  const need = extraction.need;
  if (need.agentId !== requesterAgentId) {
    return {
      kind: 'rejected',
      rejection: 'foreign-agent',
      reason: 'the need names an agent that did not emit it',
    };
  }
  if (need.question.length === 0) {
    return {
      kind: 'rejected',
      rejection: 'empty-question',
      reason: 'the need states no question',
    };
  }
  if (
    !isDelegationGranted({
      requester: requesterRole,
      target: need.targetRole,
      purpose: need.purpose,
    })
  ) {
    return {
      kind: 'rejected',
      rejection: 'capability-denied',
      reason: `a ${requesterRole} may not request ${need.targetRole} for ${need.purpose}`,
    };
  }
  if (
    !isDelegationContinuationSupported({
      requester: requesterRole,
      continuation: need.continuation,
    })
  ) {
    return {
      kind: 'rejected',
      rejection: 'unsupported-continuation',
      reason: `a ${requesterRole} may not continue with ${need.continuation}`,
    };
  }
  return { kind: 'valid', need };
};

type ObligationIdentityParams = {
  readonly requesterAgentId: string;
  readonly targetRole: AgentRole;
  readonly purpose: CapabilityPurpose;
};

export const capabilityObligationIdentity = ({
  requesterAgentId,
  targetRole,
  purpose,
}: ObligationIdentityParams): string => `${requesterAgentId}:${targetRole}:${purpose}`;

type PurposeForFindingParams = {
  readonly target: ClusterCompletionFindingTarget;
};

export const capabilityPurposeForFindingTarget = ({
  target,
}: PurposeForFindingParams): CapabilityPurpose => {
  switch (target) {
    case 'implementer':
      return 'repair';
    case 'planner':
      return 'replan';
    case 'investigator':
      return 'diagnosis';
    case 'tester':
      return 'test';
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};
