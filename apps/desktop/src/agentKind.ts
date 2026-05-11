import type { WorkflowLibraryStep } from '@kay-am/core';

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
    bg: 'bg-sky-100',
    fg: 'text-sky-700',
    label: 'scout',
  },
  planner: {
    bg: 'bg-violet-100',
    fg: 'text-violet-700',
    label: 'plan',
  },
  implementer: {
    bg: 'bg-emerald-100',
    fg: 'text-emerald-700',
    label: 'imple',
  },
  debugger: {
    bg: 'bg-orange-100',
    fg: 'text-orange-700',
    label: 'debug',
  },
  reviewer: {
    bg: 'bg-blue-100',
    fg: 'text-blue-700',
    label: 'review',
  },
  docs: {
    bg: 'bg-amber-100',
    fg: 'text-amber-700',
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
      'you are a planning agent. analyze the goal, break it into ordered steps, identify risks and dependencies. do not implement — produce a plan the implementer agent will execute. be concise.',
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
