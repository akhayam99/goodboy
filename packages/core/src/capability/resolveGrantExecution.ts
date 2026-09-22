import type {
  AgentRole,
  CapabilityContinuation,
  CapabilityPurpose,
  ProviderId,
} from '@goodboy/types';
import { getDefaultBinary } from '../providers/cli-defaults';
import { launcherResumptionSupport } from '../providers/launcherResumption';
import { isReadOnlyRole, normalizeAgentRole } from '../roles';

export type ContinuationEligibility =
  | Readonly<{ kind: 'certified'; launcher: string }>
  | Readonly<{ kind: 'ineligible'; reason: string }>;

type EligibilityParams = {
  readonly providerId: ProviderId;
  readonly binary: string | null;
  readonly providerSessionId: string | null;
  readonly providerSessionProviderId: ProviderId | null;
};

export const resolveContinuationEligibility = ({
  providerId,
  binary,
  providerSessionId,
  providerSessionProviderId,
}: EligibilityParams): ContinuationEligibility => {
  const launcher = binary === null || binary.length === 0 ? getDefaultBinary(providerId) : binary;
  if (launcherResumptionSupport({ binary: launcher }) === 'none') {
    return {
      kind: 'ineligible',
      reason: `${launcher} discards the resume session id, so this parent cannot continue natively`,
    };
  }
  if (providerSessionId === null || providerSessionId.length === 0) {
    return {
      kind: 'ineligible',
      reason: `${launcher} never returned a session id for this agent, so its resumption is unexercised`,
    };
  }
  if (providerSessionProviderId !== providerId) {
    return {
      kind: 'ineligible',
      reason: `the stored session id belongs to ${providerSessionProviderId ?? 'no provider'}, not to ${providerId}`,
    };
  }
  return { kind: 'certified', launcher };
};

const REMAINDER_CAPABLE_ROLES: Readonly<Record<AgentRole, ReadonlyArray<AgentRole>>> = {
  scout: ['scout'],
  planner: ['planner'],
  implementer: ['implementer', 'investigator'],
  reviewer: [],
  investigator: ['investigator', 'implementer'],
  tester: ['tester'],
  resolver: [],
  docs: ['docs'],
  report: ['report'],
  wireframe: ['wireframe'],
  custom: [],
};

type RemainderParams = {
  readonly remainderRole: AgentRole;
  readonly grantedRole: AgentRole;
};

export const canAssumeRemainder = ({ remainderRole, grantedRole }: RemainderParams): boolean => {
  if (isReadOnlyRole({ role: grantedRole })) {
    return false;
  }
  return REMAINDER_CAPABLE_ROLES[remainderRole].includes(grantedRole);
};

export type GrantExecutionPlan =
  | Readonly<{ kind: 'resume'; launcher: string }>
  | Readonly<{
      kind: 'transfer';
      childOwnsRemainder: boolean;
      replacementRole: AgentRole | null;
      reason: string;
    }>
  | Readonly<{ kind: 'handoff' }>;

type PlanParams = {
  readonly requesterRole: string;
  readonly requestedContinuation: CapabilityContinuation;
  readonly grantedRole: AgentRole;
  readonly eligibility: ContinuationEligibility;
};

export const resolveGrantExecution = ({
  requesterRole,
  requestedContinuation,
  grantedRole,
  eligibility,
}: PlanParams): GrantExecutionPlan => {
  if (requestedContinuation === 'handoff') {
    return { kind: 'handoff' };
  }
  if (requestedContinuation === 'resume' && eligibility.kind === 'certified') {
    return { kind: 'resume', launcher: eligibility.launcher };
  }
  const remainderRole = normalizeAgentRole({ role: requesterRole });
  const childOwnsRemainder = canAssumeRemainder({ remainderRole, grantedRole });
  const reason =
    eligibility.kind === 'ineligible'
      ? eligibility.reason
      : 'the requester asked to transfer its remaining work';
  return {
    kind: 'transfer',
    childOwnsRemainder,
    replacementRole: childOwnsRemainder ? null : remainderRole,
    reason,
  };
};

const VERIFICATION_ROLES: Readonly<Record<CapabilityPurpose, AgentRole | null>> = {
  discovery: null,
  diagnosis: null,
  repair: 'reviewer',
  test: 'tester',
  replan: null,
};

type VerificationParams = {
  readonly purpose: CapabilityPurpose;
};

export const verificationRoleForGrant = ({ purpose }: VerificationParams): AgentRole | null =>
  VERIFICATION_ROLES[purpose];
