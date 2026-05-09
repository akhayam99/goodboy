import type { ProviderId } from '@kay-am/types';

// ---------------------------------------------------------------------------
// Per-role agent defaults.
//
// Each agent in a Task is assigned a "role" (the chip the user sees in the
// sidebar). The role drives sensible default routing — the user shouldn't
// have to pick a model for every spawn, but can override when needed. These
// defaults are intentionally conservative: cheap models for read-heavy work,
// stronger models for design-heavy work.
//
// Effort is included as a hint (used as a UI default in the spawn dialog and
// passed to claude --effort when the provider supports it). Storing effort
// on Step itself is deferred to a follow-up PR; for now the seeder only
// applies provider + model.
// ---------------------------------------------------------------------------

export type AgentRole =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'investigator'
  | 'product'
  | 'architect'
  | 'tester'
  | 'explorer'
  | 'custom';

export type AgentEffort = 'low' | 'medium' | 'high' | 'extra-high' | 'max';

export interface RoleDefaults {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
  readonly description: string;
}

export const ROLE_DEFAULTS: Readonly<Record<AgentRole, RoleDefaults>> = {
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
    model: 'claude-opus-4-7',
    effort: 'high',
    description: 'design the change; produce an ordered plan',
  },
  architect: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
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
};

const KNOWN_ROLES = new Set<string>(Object.keys(ROLE_DEFAULTS));

export function isAgentRole(role: string): role is AgentRole {
  return KNOWN_ROLES.has(role);
}

/**
 * Resolve a role string from the workflow library to its defaults. Unknown
 * roles fall back to `custom` instead of throwing — library entries are
 * data, not code, and a typo there should still produce a usable agent.
 */
export function defaultsForRole(role: string): RoleDefaults {
  return isAgentRole(role) ? ROLE_DEFAULTS[role] : ROLE_DEFAULTS.custom;
}
