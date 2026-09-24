import type {
  AgentEffort,
  AgentRole,
  CapabilityContinuation,
  CapabilityPurpose,
  ProviderId,
  WorkflowTaskType,
} from '@goodboy/types';
import { devWarn } from './dev-log';

export type { AgentEffort, AgentRole } from '@goodboy/types';

export type RoleDefaults = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
  readonly description: string;
  readonly fanOut: RoleFanOutCapability;
  readonly delegation: RoleDelegationCapability;
  readonly prompt?: string;
};

export type RoleOutputKind = 'none' | 'plan' | 'report' | 'wireframe';

export type RolePresentationKey =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'debugger'
  | 'tester'
  | 'resolver'
  | 'docs'
  | 'report'
  | 'wireframe'
  | 'generic';

export type RoleRegistryEntry = RoleDefaults & {
  readonly id: AgentRole;
  readonly aliases: ReadonlyArray<string>;
  readonly presentationKey: RolePresentationKey;
  readonly defaultRoutingTaskType: WorkflowTaskType;
  readonly outputKind: RoleOutputKind;
  readonly isReadOnly: boolean;
  readonly workflowEligible: boolean;
  readonly classifierEligible: boolean;
  readonly selectionEligible: boolean;
  readonly pickerEligible: boolean;
};

export type RoleFanOutMode = 'natural' | 'conditional' | 'never';

export type RoleFanOutPartitionKey =
  'codebase-area' | 'diff-aspect' | 'module-under-test' | 'top-stack-file' | null;

export type RoleFanOutCapability = {
  readonly mode: RoleFanOutMode;
  readonly partitionKey: RoleFanOutPartitionKey;
  readonly condition: string | null;
};

export type RoleDelegationGrant = {
  readonly target: AgentRole;
  readonly purpose: CapabilityPurpose;
};

export type RoleDelegationCapability = {
  readonly grants: ReadonlyArray<RoleDelegationGrant>;
  readonly continuations: ReadonlyArray<CapabilityContinuation>;
};

const NO_DELEGATION: RoleDelegationCapability = {
  grants: [],
  continuations: [],
};

export const ROLE_REGISTRY = {
  scout: {
    id: 'scout',
    aliases: [],
    presentationKey: 'scout',
    defaultRoutingTaskType: 'exploration',
    outputKind: 'none',
    isReadOnly: true,
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'haiku-4.5',
    effort: 'low',
    description: 'survey code, list relevant files, identify abstractions; no changes',
    fanOut: {
      mode: 'natural',
      partitionKey: 'codebase-area',
      condition: null,
    },
    delegation: NO_DELEGATION,
  },
  investigator: {
    id: 'investigator',
    aliases: ['debugger'],
    presentationKey: 'debugger',
    defaultRoutingTaskType: 'debugging',
    outputKind: 'none',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'reproduce, diagnose, root-cause, patch the failure',
    fanOut: {
      mode: 'conditional',
      partitionKey: 'top-stack-file',
      condition: 'only for independent failures grouped by top stack file with no shared frames',
    },
    delegation: {
      grants: [
        { target: 'scout', purpose: 'discovery' },
        { target: 'planner', purpose: 'replan' },
      ],
      continuations: ['resume', 'transfer'],
    },
  },
  planner: {
    id: 'planner',
    aliases: [],
    presentationKey: 'planner',
    defaultRoutingTaskType: 'planning',
    outputKind: 'plan',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'opus-5',
    effort: 'high',
    description: 'design the change; produce an ordered plan',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
    delegation: {
      grants: [{ target: 'scout', purpose: 'discovery' }],
      continuations: ['resume', 'transfer'],
    },
  },
  implementer: {
    id: 'implementer',
    aliases: [],
    presentationKey: 'implementer',
    defaultRoutingTaskType: 'implementation',
    outputKind: 'none',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'apply one assigned plan or sequential cluster in small commits',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
    delegation: {
      grants: [
        { target: 'scout', purpose: 'discovery' },
        { target: 'investigator', purpose: 'diagnosis' },
        { target: 'planner', purpose: 'replan' },
      ],
      continuations: ['resume', 'transfer', 'handoff'],
    },
  },
  reviewer: {
    id: 'reviewer',
    aliases: [],
    presentationKey: 'reviewer',
    defaultRoutingTaskType: 'review',
    outputKind: 'none',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'audit the diff read-only, delegate test execution, flag drift',
    fanOut: {
      mode: 'conditional',
      partitionKey: 'diff-aspect',
      condition: 'only when changed files are over 15 or diff lines are over 800',
    },
    delegation: {
      grants: [
        { target: 'implementer', purpose: 'repair' },
        { target: 'planner', purpose: 'replan' },
        { target: 'investigator', purpose: 'diagnosis' },
        { target: 'tester', purpose: 'test' },
      ],
      continuations: ['handoff'],
    },
  },
  tester: {
    id: 'tester',
    aliases: [],
    presentationKey: 'tester',
    defaultRoutingTaskType: 'testing',
    outputKind: 'none',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'author and run tests; report production failures for an implementer',
    fanOut: {
      mode: 'conditional',
      partitionKey: 'module-under-test',
      condition:
        'only when at least two disjoint modules can be tested without shared fixtures or helpers',
    },
    delegation: {
      grants: [
        { target: 'implementer', purpose: 'repair' },
        { target: 'investigator', purpose: 'diagnosis' },
        { target: 'planner', purpose: 'replan' },
      ],
      continuations: ['handoff', 'transfer'],
    },
  },
  resolver: {
    id: 'resolver',
    aliases: [],
    presentationKey: 'resolver',
    defaultRoutingTaskType: 'implementation',
    outputKind: 'none',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'address a review comment with one local commit',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
    delegation: NO_DELEGATION,
  },
  docs: {
    id: 'docs',
    aliases: ['writer'],
    presentationKey: 'docs',
    defaultRoutingTaskType: 'writing',
    outputKind: 'none',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'haiku-4.5',
    effort: 'low',
    description: 'write repository documentation only, never reports',
    prompt:
      'you are a repository documentation agent. write and update repository documentation, READMEs, changelogs, and docstrings. never produce session reports or other report artifacts. ALLOWED: editing documentation files and documentation text. FORBIDDEN: editing production logic, writing tests, implementing features, creating plans, or writing reports.',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
    delegation: NO_DELEGATION,
  },
  report: {
    id: 'report',
    aliases: [],
    presentationKey: 'report',
    defaultRoutingTaskType: 'writing',
    outputKind: 'report',
    isReadOnly: true,
    workflowEligible: true,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: false,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'produce a requested report from supplied evidence',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
    delegation: NO_DELEGATION,
  },
  wireframe: {
    id: 'wireframe',
    aliases: [],
    presentationKey: 'wireframe',
    defaultRoutingTaskType: 'planning',
    outputKind: 'wireframe',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: false,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'produce a requested wireframe from supplied product evidence',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
    delegation: NO_DELEGATION,
  },
  custom: {
    id: 'custom',
    aliases: ['generic'],
    presentationKey: 'generic',
    defaultRoutingTaskType: 'general',
    outputKind: 'none',
    isReadOnly: false,
    workflowEligible: true,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: true,
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'user-defined role',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
    delegation: NO_DELEGATION,
  },
} as const satisfies Readonly<Record<AgentRole, RoleRegistryEntry>>;

const ROLE_ENTRIES: ReadonlyArray<RoleRegistryEntry> = Object.values(ROLE_REGISTRY);

export const SELECTABLE_AGENT_ROLES: ReadonlyArray<AgentRole> = ROLE_ENTRIES.filter(
  (entry) => entry.selectionEligible,
).map((entry) => entry.id);

const roleEntryForInput = (role: string): RoleRegistryEntry | null => {
  const candidate = role.trim().toLowerCase();
  return (
    ROLE_ENTRIES.find(
      (entry) =>
        entry.id === candidate ||
        entry.presentationKey === candidate ||
        entry.aliases.includes(candidate),
    ) ?? null
  );
};

export const isAgentRole = (role: string): role is AgentRole => {
  return ROLE_ENTRIES.some((entry) => entry.id === role);
};

type NormalizeAgentRoleParams = {
  readonly role: string | undefined;
};

export const normalizeAgentRole = ({ role }: NormalizeAgentRoleParams): AgentRole => {
  if (role == null) {
    devWarn('[roles] missing role; using custom');
    return 'custom';
  }
  const entry = roleEntryForInput(role);
  if (entry !== null) {
    return entry.id;
  }
  devWarn(`[roles] unknown role ${JSON.stringify(role)}; using custom`);
  return 'custom';
};

export const normalizeSelectableAgentRole = ({ role }: NormalizeAgentRoleParams): AgentRole => {
  const normalized = normalizeAgentRole({ role });
  if (ROLE_REGISTRY[normalized].selectionEligible) {
    return normalized;
  }
  return 'custom';
};

export const presentationKeyForRole = ({ role }: NormalizeAgentRoleParams): RolePresentationKey =>
  ROLE_REGISTRY[normalizeAgentRole({ role })].presentationKey;

export const isReadOnlyRole = ({ role }: NormalizeAgentRoleParams): boolean =>
  ROLE_REGISTRY[normalizeAgentRole({ role })].isReadOnly;

export const defaultsForRole = (role: string): RoleDefaults => {
  return ROLE_REGISTRY[normalizeAgentRole({ role })];
};

export const fanOutCapabilityForRole = (role: string): RoleFanOutCapability => {
  return defaultsForRole(role).fanOut;
};

export const delegationCapabilityForRole = (role: string): RoleDelegationCapability => {
  return defaultsForRole(role).delegation;
};

type DelegationGrantParams = {
  readonly requester: string;
  readonly target: string;
  readonly purpose: CapabilityPurpose;
};

export const isDelegationGranted = ({
  requester,
  target,
  purpose,
}: DelegationGrantParams): boolean => {
  const targetRole = normalizeAgentRole({ role: target });
  return delegationCapabilityForRole(requester).grants.some(
    (grant) => grant.target === targetRole && grant.purpose === purpose,
  );
};

type DelegationContinuationParams = {
  readonly requester: string;
  readonly continuation: CapabilityContinuation;
};

export const isDelegationContinuationSupported = ({
  requester,
  continuation,
}: DelegationContinuationParams): boolean =>
  delegationCapabilityForRole(requester).continuations.includes(continuation);
