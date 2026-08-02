import type { AgentEffort, AgentRole, ProviderId } from '@goodboy/types';

export type { AgentEffort, AgentRole } from '@goodboy/types';

export type RoleDefaults = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
  readonly description: string;
  readonly fanOut: RoleFanOutCapability;
};

export type RoleFanOutMode = 'natural' | 'conditional' | 'never';

export type RoleFanOutPartitionKey =
  | 'codebase-area'
  | 'diff-aspect'
  | 'module-under-test'
  | 'top-stack-file'
  | null;

export type RoleFanOutCapability = {
  readonly mode: RoleFanOutMode;
  readonly partitionKey: RoleFanOutPartitionKey;
  readonly condition: string | null;
};

export const ROLE_DEFAULTS = {
  scout: {
    provider: 'anthropic',
    model: 'haiku-4.5',
    effort: 'low',
    description: 'survey code, list relevant files, identify abstractions; no changes',
    fanOut: {
      mode: 'natural',
      partitionKey: 'codebase-area',
      condition: null,
    },
  },
  investigator: {
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'reproduce, diagnose, root-cause, patch the failure',
    fanOut: {
      mode: 'conditional',
      partitionKey: 'top-stack-file',
      condition: 'only for independent failures grouped by top stack file with no shared frames',
    },
  },
  planner: {
    provider: 'anthropic',
    model: 'opus-5',
    effort: 'high',
    description: 'design the change; produce an ordered plan',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  implementer: {
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'apply the planned change in small commits',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  reviewer: {
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'audit the diff, run tests, flag drift',
    fanOut: {
      mode: 'conditional',
      partitionKey: 'diff-aspect',
      condition: 'only when changed files are over 15 or diff lines are over 800',
    },
  },
  tester: {
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'write tests covering happy path + edge cases',
    fanOut: {
      mode: 'conditional',
      partitionKey: 'module-under-test',
      condition:
        'only when at least two disjoint modules can be tested without shared fixtures or helpers',
    },
  },
  custom: {
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
    description: 'user-defined role',
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
} as const satisfies Readonly<Record<AgentRole, RoleDefaults>>;

const KNOWN_ROLES = new Set<string>(Object.keys(ROLE_DEFAULTS));

export const isAgentRole = (role: string): role is AgentRole => {
  return KNOWN_ROLES.has(role);
};

export const defaultsForRole = (role: string): RoleDefaults => {
  return isAgentRole(role) ? ROLE_DEFAULTS[role] : ROLE_DEFAULTS.custom;
};

export const fanOutCapabilityForRole = (role: string): RoleFanOutCapability => {
  return defaultsForRole(role).fanOut;
};
