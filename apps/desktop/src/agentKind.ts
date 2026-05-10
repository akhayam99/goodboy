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
    label: 'planner',
  },
  implementer: {
    bg: 'bg-emerald-100',
    fg: 'text-emerald-700',
    label: 'impl',
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
  { model: string; effort: 'low' | 'medium' | 'high'; verbosity?: 'low' | 'medium' | 'high' }
> = {
  scout: { model: 'claude-haiku-4-5', effort: 'low' },
  docs: { model: 'claude-haiku-4-5', effort: 'low' },
  generic: { model: 'claude-haiku-4-5', effort: 'low' },
  implementer: { model: 'claude-sonnet-4-5', effort: 'medium' },
  debugger: { model: 'claude-sonnet-4-5', effort: 'medium' },
  reviewer: { model: 'claude-sonnet-4-5', effort: 'medium' },
  planner: { model: 'claude-opus-4-5', effort: 'high' },
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
