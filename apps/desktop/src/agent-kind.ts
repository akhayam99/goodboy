import { classifyFirstTurn, type FirstTurnRole, type WorkflowLibraryStep } from '@kay-am/core';

export type AgentKind =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'debugger'
  | 'reviewer'
  | 'docs'
  | 'generic';

export const AGENT_KIND_PALETTE: Record<AgentKind, { bg: string; fg: string; label: string }> = {
  scout: {
    bg: 'bg-info/15',
    fg: 'text-info',
    label: 'scout',
  },
  planner: {
    bg: 'bg-primary/15',
    fg: 'text-primary',
    label: 'plan',
  },
  implementer: {
    bg: 'bg-success/15',
    fg: 'text-success',
    label: 'imple',
  },
  debugger: {
    bg: 'bg-warning/15',
    fg: 'text-warning',
    label: 'debug',
  },
  reviewer: {
    bg: 'bg-info/20',
    fg: 'text-info',
    label: 'review',
  },
  docs: {
    bg: 'bg-warning/10',
    fg: 'text-warning',
    label: 'docs',
  },
  generic: {
    bg: 'bg-muted',
    fg: 'text-muted-foreground',
    label: 'agent',
  },
};

export const AGENT_KIND_DEFAULTS: Record<
  AgentKind,
  {
    model: string;
    effort: 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
    // Optional role bias appended to the claude system prompt via
    // `--append-system-prompt`. Kept short to avoid drowning the user prompt;
    // only kinds with a sharp role have one.
    systemPrompt?: string;
  }
> = {
  scout: { model: 'claude-haiku-4-5', effort: 'low' },
  docs: { model: 'claude-haiku-4-5', effort: 'low' },
  generic: { model: 'claude-haiku-4-5', effort: 'low' },
  implementer: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    systemPrompt:
      'you are an implementation agent. execute the plan precisely. write code, run tests, fix issues. do not re-plan unless blocked. report progress at key checkpoints.',
  },
  debugger: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    systemPrompt:
      'you are a debugging agent. reproduce the failure, isolate the root cause, propose minimal fixes. prefer instrumentation over assumptions. report findings before patching.',
  },
  reviewer: { model: 'claude-sonnet-4-5', effort: 'medium' },
  planner: {
    model: 'claude-opus-4-5',
    effort: 'high',
    systemPrompt:
      'you are a planning agent. analyze the goal, break it into ordered steps, identify risks and dependencies. do not implement — produce a plan the implementer agent will execute. be concise. wrap your final plan in <<plan>>...<</plan>> markers so it can be captured as a session artifact. the first line of the plan body is the title; the rest is markdown. emit exactly one plan block per turn.',
  },
};

const ROLE_TO_KIND: Record<string, AgentKind> = {
  scout: 'scout',
  explorer: 'scout',
  investigator: 'debugger',
  planner: 'planner',
  architect: 'planner',
  product: 'planner',
  implementer: 'implementer',
  tester: 'reviewer',
  reviewer: 'reviewer',
  docs: 'docs',
  writer: 'docs',
};

export function inferAgentKindFromStep(step: WorkflowLibraryStep): AgentKind {
  const role = step.role.toLowerCase();
  return ROLE_TO_KIND[role] ?? 'generic';
}

export function inferAgentKindFromName(name: string): AgentKind {
  const lower = name.toLowerCase();
  if (/scout|explor|survey|map/.test(lower)) return 'scout';
  if (/plan|design|architect|spec|product/.test(lower)) return 'planner';
  if (/impl|build|develop|code|feature|refactor/.test(lower)) return 'implementer';
  if (/debug|diagno|fix|repro|investig/.test(lower)) return 'debugger';
  if (/review|verify|test|check|qa/.test(lower)) return 'reviewer';
  if (/doc|write|readme|changelog/.test(lower)) return 'docs';
  return 'generic';
}

// Bridges the core classifier's neutral role union to the desktop's AgentKind
// enum. `tester` is folded into `reviewer` to match the existing AgentRole
// mapping in packages/core/src/roles.ts.
const FIRST_TURN_ROLE_TO_KIND: Readonly<Record<FirstTurnRole, AgentKind>> = {
  scout: 'scout',
  plan: 'planner',
  implement: 'implementer',
  review: 'reviewer',
  test: 'reviewer',
  docs: 'docs',
  debug: 'debugger',
};

/**
 * Resolve the chip's display kind. Prefers name-based inference; if that
 * yields `generic`, falls back to classifying the agent's first user turn.
 * Conservative — when the first turn cannot be confidently classified, stays
 * `generic` (chip shows "agent").
 */
export function resolveAgentKind(name: string, firstUserText: string | null): AgentKind {
  const fromName = inferAgentKindFromName(name);
  if (fromName !== 'generic') return fromName;
  if (!firstUserText) return 'generic';
  const classified = classifyFirstTurn(firstUserText);
  if (classified === 'unknown') return 'generic';
  return FIRST_TURN_ROLE_TO_KIND[classified];
}
