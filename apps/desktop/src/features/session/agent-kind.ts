import { classifyFirstTurn, type AgentKindLabel, type WorkflowLibraryStep } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';

export type AgentKind = AgentKindLabel;

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

// `fg` deliberately mirrors the `bg` hue so an icon (tinted via `bg`) and its
// label text always read as the same colour. Using semantic tokens for `fg`
// (text-primary/info/...) drifted from the tint and looked broken.
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

// Roles the user can assign to a workflow step. Curated to exactly the agents
// that are spawnable from the main "Create agent" menu (AGENT_KIND_ORDER where
// visible !== false), so the picker never offers a role that isn't a real
// agent. architect/product/explorer were dropped: they aren't distinct
// spawnable kinds (they collapsed onto planner/generic/scout). 'custom' = the
// generic agent. ROLE_TO_KIND/ROLE_LABEL still cover the dropped values so any
// legacy step that used them still renders.
export const AGENT_ROLES: ReadonlyArray<AgentRole> = [
  'scout',
  'planner',
  'implementer',
  'reviewer',
  'tester',
  'investigator',
  'custom',
];

// Maps a workflow role to the persona kind used for the icon/colour/system
// prompt. Roles without a 1:1 kind fall back to the closest visual match.
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

// Inverse of ROLE_TO_KIND, used to seed a role for legacy steps that only have
// a name (the kind is inferred from the name, then mapped back to a role).
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
    // Optional role bias appended to the claude system prompt via
    // `--append-system-prompt`. Kept short to avoid drowning the user prompt;
    // only kinds with a sharp role have one.
    systemPrompt?: string;
    // When false, the kind is spawnable only programmatically (by other
    // UI surfaces, e.g. the PR resolve flow) and is hidden from the manual
    // "Create agent" menu. Defaults to visible.
    visible?: boolean;
  }
> = {
  scout: {
    model: 'claude-haiku-4-5',
    effort: 'low',
    systemPrompt:
      'you are a scout agent. explore the codebase, answer questions, locate files and symbols. ALLOWED: read files, search, summarize findings, report structure. FORBIDDEN: editing files, writing code, creating plans, running tests. if you catch yourself doing a forbidden action, stop and say "this is outside my scope, spawn an implementer or planner agent". when your exploration is complete and the user clearly needs implementation or planning next, emit a single self-closing `<<handoff kind=implementer reason="..." >>` or `<<handoff kind=planner reason="..." >>` marker on its own line.',
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
      'you are a planning agent. analyze the goal, break it into ordered steps, identify risks and dependencies. do not implement, produce a plan the implementer agent will execute. be concise. ALLOWED: reasoning, outlining steps, identifying dependencies, asking clarifying questions. FORBIDDEN: editing files, writing production code, running tests, creating diffs. wrap your final plan in <<plan>>...<</plan>> markers so it can be captured as a session artifact. the first line of the plan body is the title; the rest is markdown. emit exactly one plan block per turn. when the plan is complete and has no open questions, also emit a single self-closing marker `<<handoff kind=implementer reason="..." >>` on its own line, the desktop UI shows it as a CTA to spawn an implementer agent. do not emit handoff if you still need user input.',
  },
  resolver: {
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    visible: false,
    systemPrompt:
      'you are a resolver agent. address ONE specific review comment with the smallest reasonable change. the kickoff will include the comment text, the file path/line (if any), and the review thread id. ALLOWED: reading the referenced files, editing them, running lint/tests, `git add` + `git commit` LOCALLY. FORBIDDEN: `git push` (never), refactoring beyond the comment scope, writing tests for unrelated code, creating plans, redesigning architecture, opening new files outside the comment\'s path unless the fix demands it. classify your change before committing: EASY (rename, typo, formatting, import fix, one-liner, literal/constant change) → commit immediately. NON-TRIVIAL (structural rework, multi-file refactor, new/deleted files, architecture change, anything you are uncertain about) → STOP, show a short summary of the proposed change, ask "Can I commit?" and wait for explicit confirmation before committing. after a successful local commit, if the kickoff carried a review thread id, emit on its own line: `<<comment-resolved threadId="<id>" commit="<full sha from git rev-parse HEAD>">>`. emit the marker exactly once, only after the commit succeeds, only when a thread id was provided.',
  },
};

// Loose lookup for arbitrary role strings coming from WorkflowLibraryStep.role
// (a free-form string), distinct from the strict AgentRole-keyed ROLE_TO_KIND
// above. Keeps extra synonyms (writer, docs, resolver) the strict map omits.
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

export function inferAgentKindFromStep(step: WorkflowLibraryStep): AgentKind {
  const role = step.role.toLowerCase();
  return STEP_ROLE_KIND_LOOKUP[role] ?? 'generic';
}

export function inferAgentKindFromName(name: string): AgentKind {
  const lower = name.toLowerCase();
  // 'resolve' must come before 'review' so a name like `resolve: bob on
  // foo.ts:42` lands as resolver, not reviewer.
  if (/^resolve\b|: resolve|resolve(?:r|s|d)?\b/.test(lower)) return 'resolver';
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
 * else name-based inference, else first-turn classification. Conservative:
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
