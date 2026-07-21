import type { AgentEffort, AgentRole, ProviderId } from '@goodboy/types';

export type { AgentEffort, AgentRole } from '@goodboy/types';

export type RoleDefaults = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
  readonly description: string;
};

export const ROLE_DEFAULTS = {
  scout: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    effort: 'low',
    description: 'survey code, list relevant files, identify abstractions; no changes',
  },
  investigator: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    effort: 'low',
    description: 'reproduce, diagnose, root-cause; no fixes',
  },
  planner: {
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    effort: 'high',
    description: 'design the change; produce an ordered plan',
  },
  architect: {
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    effort: 'high',
    description: 'propose technical approach, modules, data flow, migrations',
  },
  product: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    description: 'clarify user-facing behavior + acceptance criteria',
  },
  implementer: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    description: 'apply the planned change in small commits',
  },
  reviewer: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    description: 'audit the diff, run tests, flag drift',
  },
  tester: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    description: 'write tests covering happy path + edge cases',
  },
  explorer: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    description: 'open-ended chat; no fixed structure',
  },
  custom: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    description: 'user-defined role',
  },
} as const satisfies Readonly<Record<AgentRole, RoleDefaults>>;

const KNOWN_ROLES = new Set<string>(Object.keys(ROLE_DEFAULTS));

export const isAgentRole = (role: string): role is AgentRole => {
  return KNOWN_ROLES.has(role);
};

export const defaultsForRole = (role: string): RoleDefaults => {
  return isAgentRole(role) ? ROLE_DEFAULTS[role] : ROLE_DEFAULTS.custom;
};
