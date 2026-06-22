import { classifyFirstTurn, type AgentKindLabel, type WorkflowLibraryStep } from '@goodboy/core';
import type { Agent, AgentRole } from '@goodboy/types';

export type AgentKind = AgentKindLabel;

export type AgentHomeLens = 'agents' | 'resolve' | 'workflows';

export const agentHomeLens = (agent: Agent, kind: AgentKind): AgentHomeLens => {
  if (agent.workflowRunId != null) {
    return 'workflows';
  }
  if (kind === 'resolver') {
    return 'resolve';
  }
  return 'agents';
};

export const AGENT_KIND_ORDER: ReadonlyArray<AgentKind> = [
  'planner',
  'scout',
  'implementer',
  'debugger',
  'tester',
  'reviewer',
  'docs',
  'resolver',
  'generic',
];

export const PLAN_CONSUMING_KINDS: ReadonlySet<AgentKind> = new Set<AgentKind>([
  'implementer',
  'debugger',
  'generic',
]);

export const kindConsumesPlan = (kind: AgentKind): boolean => {
  return PLAN_CONSUMING_KINDS.has(kind);
};

export const AGENT_KIND_META: Record<AgentKind, { label: string; hint: string; persona: string }> =
  {
    generic: {
      label: 'Agent',
      hint: 'Can do whatever you want, no restrictions',
      persona: 'max',
    },
    scout: {
      label: 'Scout',
      hint: 'Reads and searches codebase. Never edits files',
      persona: 'scout',
    },
    planner: {
      label: 'Plan',
      hint: 'Analyzes goals, produces a plan. No code, no edits',
      persona: 'drafty',
    },
    implementer: {
      label: 'Implement',
      hint: 'Writes code based on active plan. No re-planning',
      persona: 'hammer',
    },
    debugger: {
      label: 'Debug',
      hint: 'Reproduces and fixes bugs. No refactoring, no planning',
      persona: 'sherlock',
    },
    tester: {
      label: 'Test',
      hint: 'Writes tests. No production code changes',
      persona: 'beaker',
    },
    reviewer: {
      label: 'Review',
      hint: 'Reviews diffs, suggests fixes. Read-only',
      persona: 'specs',
    },
    docs: {
      label: 'Docs',
      hint: 'Writes documentation. No production logic',
      persona: 'scribble',
    },
    resolver: {
      label: 'Resolve',
      hint: 'Addresses one comment with a local commit. Spawned by the resolve UI',
      persona: 'patches',
    },
  };

export const AGENT_KIND_PALETTE: Record<AgentKind, { bg: string; fg: string; label: string }> = {
  scout: {
    bg: 'bg-sky-400',
    fg: 'text-sky-400',
    label: 'scout',
  },
  planner: {
    bg: 'bg-violet-400',
    fg: 'text-violet-400',
    label: 'plan',
  },
  implementer: {
    bg: 'bg-emerald-400',
    fg: 'text-emerald-400',
    label: 'imple',
  },
  debugger: {
    bg: 'bg-amber-400',
    fg: 'text-amber-400',
    label: 'debug',
  },
  tester: {
    bg: 'bg-teal-400',
    fg: 'text-teal-400',
    label: 'test',
  },
  reviewer: {
    bg: 'bg-cyan-400',
    fg: 'text-cyan-400',
    label: 'review',
  },
  docs: {
    bg: 'bg-orange-400',
    fg: 'text-orange-400',
    label: 'docs',
  },
  resolver: {
    bg: 'bg-lime-400',
    fg: 'text-lime-400',
    label: 'resolve',
  },
  generic: {
    bg: 'bg-rose-400',
    fg: 'text-rose-400',
    label: 'agent',
  },
};

export const AGENT_ROLES: ReadonlyArray<AgentRole> = [
  'scout',
  'planner',
  'implementer',
  'reviewer',
  'tester',
  'investigator',
  'custom',
];

export const ROLE_TO_KIND: Record<AgentRole, AgentKind> = {
  scout: 'scout',
  planner: 'planner',
  architect: 'planner',
  product: 'generic',
  implementer: 'implementer',
  reviewer: 'reviewer',
  tester: 'tester',
  investigator: 'debugger',
  explorer: 'scout',
  custom: 'generic',
};

export const KIND_TO_ROLE: Record<AgentKind, AgentRole> = {
  scout: 'scout',
  planner: 'planner',
  implementer: 'implementer',
  debugger: 'investigator',
  tester: 'tester',
  reviewer: 'reviewer',
  docs: 'custom',
  resolver: 'custom',
  generic: 'custom',
};

export const ROLE_LABEL: Record<AgentRole, string> = {
  scout: 'Scout',
  planner: 'Planner',
  architect: 'Architect',
  product: 'Product',
  implementer: 'Implementer',
  reviewer: 'Reviewer',
  tester: 'Tester',
  investigator: 'Debugger',
  explorer: 'Explorer',
  custom: 'Custom',
};

export const AGENT_KIND_DEFAULTS: Record<
  AgentKind,
  {
    model: string;
    effort: 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
    systemPrompt?: string;
    visible?: boolean;
  }
> = {
  scout: {
    model: 'claude-haiku-4-5',
    effort: 'low',
    systemPrompt:
      'you are a scout agent. explore the codebase, answer questions, locate files and symbols. ALLOWED: read files, search, summarize findings, report structure. FORBIDDEN: editing files, writing code, creating plans, running tests. for a focused or single-area question, answer directly: do NOT split. only when the search genuinely spans 3 or more substantial areas or domains, each needing real reading, first do a cheap discovery pass naming the areas, then emit on its own line `<<scout-split>>` followed by a JSON array of `{"area":"<specific name>","query":"<what to find there>"}` (2 to 6 disjoint entries) then `<</scout-split>>`; the runtime spawns one parallel sub-scout per area and re-activates you to consolidate their findings. each area name must be specific (e.g. "auth domain", never "area 1"). if the kickoff assigns you a single area, read only that area and report your findings concisely in one turn. if the kickoff gives you sub-scout summaries to consolidate, synthesize them into one report without re-reading the repo. if you catch yourself editing or planning, stop and say "this is outside my scope, spawn an implementer or planner agent". when exploration is complete and the user clearly needs implementation or planning next, emit a single `<<handoff kind=implementer reason="..." >>` or `<<handoff kind=planner reason="..." >>` marker on its own line.',
  },
  docs: {
    model: 'claude-haiku-4-5',
    effort: 'low',
    systemPrompt:
      'you are a documentation agent. write and update documentation, READMEs, changelogs, and comments. ALLOWED: editing markdown files, writing docstrings, updating READMEs. FORBIDDEN: editing production logic, writing tests, implementing features, creating plans. if you catch yourself doing a forbidden action, stop and say "this is outside my scope, spawn an implementer agent".',
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
      'you are a review agent. read the diff, identify bugs, style issues, and correctness concerns. ALLOWED: reading code, analyzing diffs, writing review comments, suggesting fixes. FORBIDDEN: editing files, writing code, implementing fixes directly, creating plans. present findings as a structured review. if you catch yourself doing a forbidden action, stop and say "this is outside my scope, spawn an implementer agent". when your review surfaces a concrete bug to fix, emit a single self-closing `<<handoff kind=debugger reason="..." >>` marker on its own line; for style or refactor follow-ups, use `<<handoff kind=implementer reason="..." >>`.',
  },
  planner: {
    model: 'claude-opus-4-5',
    effort: 'high',
    systemPrompt:
      'you are a planning agent. analyze the goal, break it into ordered steps, identify risks and dependencies. do not implement, produce a plan the implementer agent will execute. be concise. ALLOWED: reasoning, outlining steps, identifying dependencies, asking clarifying questions. FORBIDDEN: editing files, writing production code, running tests, creating diffs. wrap your final plan in <<plan>>...<</plan>> markers so it can be captured as a session artifact. the first line of the plan body is the title; the rest is markdown. emit exactly one plan block per turn. immediately after the plan block, emit a single `<<clusters>>...<</clusters>>` block whose body is a JSON array grouping the plan into 2 to 5 sequential execution clusters split at dependency seams (a later cluster may rely on an earlier one having finished). each entry is `{"title": "<concise 3 to 6 word label>", "instructions": "<the exact slice of the plan this cluster executes, as markdown>"}`. clusters run in array order, so order them by dependency. titles must be specific and taken from the plan (e.g. "move files to domain", never "phase 1"). if the work is small and atomic, emit a single cluster. when the plan is complete and has no open questions, also emit a single self-closing marker `<<handoff kind=implementer reason="..." >>` on its own line, the desktop UI shows it as a CTA to spawn an implementer agent. do not emit handoff if you still need user input.',
  },
  resolver: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    visible: false,
    systemPrompt:
      'you are a resolver agent. address ONE specific review comment with the smallest reasonable change. the kickoff will include the comment text, the file path/line (if any), and the review thread id. ALLOWED: reading the referenced files, editing them, running lint/tests, `git add` + `git commit` LOCALLY. FORBIDDEN: `git push` (never), refactoring beyond the comment scope, writing tests for unrelated code, creating plans, redesigning architecture, opening new files outside the comment\'s path unless the fix demands it. classify your change before committing: EASY (rename, typo, formatting, import fix, one-liner, literal/constant change) → commit immediately. NON-TRIVIAL (structural rework, multi-file refactor, new/deleted files, architecture change, anything you are uncertain about) → STOP, show a short summary of the proposed change, ask "Can I commit?" and wait for explicit confirmation before committing. after a successful local commit, if the kickoff carried a review thread id, emit on its own line: `<<comment-resolved threadId="<id>" commit="<full sha from git rev-parse HEAD>">>`. emit the marker exactly once, only after the commit succeeds, only when a thread id was provided. if after analysis you conclude the comment should NOT be acted on (invalid, out of scope, already handled, based on a misunderstanding, or a bad suggestion), do NOT commit: explain why in one short paragraph, then if a thread id was provided emit on its own line `<<comment-wontfix threadId="<id>" reason="<concise one-line reason, plain text, no double quotes>">>`. choose either comment-resolved or comment-wontfix, never both.',
  },
};

const STEP_ROLE_KIND_LOOKUP: Record<string, AgentKind> = {
  scout: 'scout',
  explorer: 'scout',
  investigator: 'debugger',
  planner: 'planner',
  architect: 'planner',
  product: 'planner',
  implementer: 'implementer',
  tester: 'tester',
  reviewer: 'reviewer',
  resolver: 'resolver',
  docs: 'docs',
  writer: 'docs',
};

export const inferAgentKindFromStep = (step: WorkflowLibraryStep): AgentKind => {
  const role = step.role.toLowerCase();
  return STEP_ROLE_KIND_LOOKUP[role] ?? 'generic';
};

export const inferAgentKindFromName = (name: string): AgentKind => {
  const lower = name.toLowerCase();
  if (/^resolve\b|: resolve|resolve(?:r|s|d)?\b/.test(lower)) {
    return 'resolver';
  }
  if (/scout|explor|survey|map/.test(lower)) {
    return 'scout';
  }
  if (/plan|design|architect|spec|product/.test(lower)) {
    return 'planner';
  }
  if (/impl|build|develop|code|feature|refactor/.test(lower)) {
    return 'implementer';
  }
  if (/debug|diagno|fix|repro|investig/.test(lower)) {
    return 'debugger';
  }
  if (/test|qa/.test(lower)) {
    return 'tester';
  }
  if (/review|verify|check|audit/.test(lower)) {
    return 'reviewer';
  }
  if (/doc|readme|changelog/.test(lower)) {
    return 'docs';
  }
  return 'generic';
};

export const resolveAgentKind = (
  name: string,
  firstUserText: string | null,
  override: AgentKind | null = null,
): AgentKind => {
  if (override) {
    return override;
  }
  const fromName = inferAgentKindFromName(name);
  if (fromName !== 'generic') {
    return fromName;
  }
  if (!firstUserText) {
    return 'generic';
  }
  return classifyFirstTurn(firstUserText);
};
