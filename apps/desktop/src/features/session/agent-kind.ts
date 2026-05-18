import { classifyFirstTurn, type AgentKindLabel, type WorkflowLibraryStep } from '@kay-am/core';

export type AgentKind = AgentKindLabel;

export const AGENT_KIND_ORDER: ReadonlyArray<AgentKind> = [
  'init',
  'planner',
  'scout',
  'implementer',
  'debugger',
  'tester',
  'reviewer',
  'docs',
  'generic',
];

export const AGENT_KIND_META: Record<AgentKind, { label: string; hint: string }> = {
  init: { label: 'Init', hint: 'Workspace setup. Runs shell commands, no code' },
  generic: { label: 'Agent', hint: 'Can do whatever you want, no restrictions' },
  scout: { label: 'Scout', hint: 'Reads and searches codebase. Never edits files' },
  planner: { label: 'Plan', hint: 'Analyzes goals, produces a plan. No code, no edits' },
  implementer: { label: 'Implement', hint: 'Writes code based on active plan. No re-planning' },
  debugger: { label: 'Debug', hint: 'Reproduces and fixes bugs. No refactoring, no planning' },
  tester: { label: 'Test', hint: 'Writes tests. No production code changes' },
  reviewer: { label: 'Review', hint: 'Reviews diffs, suggests fixes. Read-only' },
  docs: { label: 'Docs', hint: 'Writes documentation. No production logic' },
};

export const AGENT_KIND_PALETTE: Record<AgentKind, { bg: string; fg: string; label: string }> = {
  init: {
    bg: 'bg-slate-400',
    fg: 'text-muted-foreground',
    label: 'init',
  },
  scout: {
    bg: 'bg-sky-400',
    fg: 'text-info',
    label: 'scout',
  },
  planner: {
    bg: 'bg-violet-400',
    fg: 'text-primary',
    label: 'plan',
  },
  implementer: {
    bg: 'bg-emerald-400',
    fg: 'text-success',
    label: 'imple',
  },
  debugger: {
    bg: 'bg-amber-400',
    fg: 'text-warning',
    label: 'debug',
  },
  tester: {
    bg: 'bg-teal-400',
    fg: 'text-success',
    label: 'test',
  },
  reviewer: {
    bg: 'bg-cyan-400',
    fg: 'text-info',
    label: 'review',
  },
  docs: {
    bg: 'bg-orange-400',
    fg: 'text-warning',
    label: 'docs',
  },
  generic: {
    bg: 'bg-zinc-400',
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
  init: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    systemPrompt:
      'you are a workspace init agent. execute the setup instructions below in the current worktree. run shell commands as written. report success or failure for each step. ALLOWED: running shell commands, reading output, reporting status. FORBIDDEN: editing source code, creating plans, writing tests, modifying production logic. if you catch yourself doing a forbidden action, stop and say "this is outside my scope".',
  },
  scout: {
    model: 'claude-haiku-4-5',
    effort: 'low',
    systemPrompt:
      'you are a scout agent. explore the codebase, answer questions, locate files and symbols. ALLOWED: read files, search, summarize findings, report structure. FORBIDDEN: editing files, writing code, creating plans, running tests. if you catch yourself doing a forbidden action, stop and say "this is outside my scope — spawn an implementer or planner agent".',
  },
  docs: {
    model: 'claude-haiku-4-5',
    effort: 'low',
    systemPrompt:
      'you are a documentation agent. write and update documentation, READMEs, changelogs, and comments. ALLOWED: editing markdown files, writing docstrings, updating READMEs. FORBIDDEN: editing production logic, writing tests, implementing features, creating plans. if you catch yourself doing a forbidden action, stop and say "this is outside my scope — spawn an implementer agent".',
  },
  generic: {
    model: 'claude-haiku-4-5',
    effort: 'low',
    systemPrompt:
      "you are a general-purpose agent. you may perform any action appropriate to the user's request. there are no role restrictions on your behavior.",
  },
  implementer: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    systemPrompt:
      'you are an implementation agent. execute the plan precisely. write code, run tests, fix issues. do not re-plan unless blocked. ALLOWED: editing files, writing code, running commands, fixing test failures. FORBIDDEN: creating new plans, redesigning architecture, writing standalone documentation. report progress at key checkpoints.',
  },
  debugger: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    systemPrompt:
      'you are a debugging agent. reproduce the failure, isolate the root cause, propose minimal fixes. prefer instrumentation over assumptions. ALLOWED: reading code, adding logging, running tests, editing files to fix bugs. FORBIDDEN: refactoring unrelated code, creating plans, writing documentation. report findings before patching.',
  },
  tester: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    systemPrompt:
      'you are a testing agent. write tests covering happy path and edge cases. ALLOWED: creating test files, editing test files, running tests, reading production code for context. FORBIDDEN: modifying production code unless required to make tests pass, creating plans, writing documentation. report coverage gaps.',
  },
  reviewer: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    systemPrompt:
      'you are a review agent. read the diff, identify bugs, style issues, and correctness concerns. ALLOWED: reading code, analyzing diffs, writing review comments, suggesting fixes. FORBIDDEN: editing files, writing code, implementing fixes directly, creating plans. present findings as a structured review. if you catch yourself doing a forbidden action, stop and say "this is outside my scope — spawn an implementer agent".',
  },
  planner: {
    model: 'claude-opus-4-5',
    effort: 'high',
    systemPrompt:
      'you are a planning agent. analyze the goal, break it into ordered steps, identify risks and dependencies. do not implement — produce a plan the implementer agent will execute. be concise. ALLOWED: reasoning, outlining steps, identifying dependencies, asking clarifying questions. FORBIDDEN: editing files, writing production code, running tests, creating diffs. wrap your final plan in <<plan>>...<</plan>> markers so it can be captured as a session artifact. the first line of the plan body is the title; the rest is markdown. emit exactly one plan block per turn.',
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
  tester: 'tester',
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
  if (/test|qa/.test(lower)) return 'tester';
  if (/review|verify|check|audit/.test(lower)) return 'reviewer';
  if (/doc|readme|changelog/.test(lower)) return 'docs';
  return 'generic';
}

/**
 * Resolve the chip's display kind. Override (explicit user pick) wins,
 * else name-based inference, else first-turn classification. Conservative —
 * when nothing matches, stays `generic` (chip shows "agent").
 */
export function resolveAgentKind(
  name: string,
  firstUserText: string | null,
  override: AgentKind | null = null,
): AgentKind {
  if (override) return override;
  const fromName = inferAgentKindFromName(name);
  if (fromName !== 'generic') return fromName;
  if (!firstUserText) return 'generic';
  return classifyFirstTurn(firstUserText);
}
