import {
  classifyFirstTurn,
  getCheapModel,
  presentationKeyForRole,
  REPORT_KIT_GUIDE,
  ROLE_REGISTRY,
  SELECTABLE_AGENT_ROLES,
  resolveRoleRouting,
  WIREFRAME_SCHEMA_BRIEF,
  type AgentKindLabel,
} from '@goodboy/core';
import type {
  Agent,
  AgentEffort,
  AgentId,
  AgentRole,
  ProviderId,
  RoleModelPreferences,
} from '@goodboy/types';

export type AgentKind = AgentKindLabel;

export type AgentHomeLens = 'agents' | 'review' | 'workflows';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly agentId: AgentId;
};

export const resolveRootAgent = ({ agents, agentId }: Params): Agent | null => {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  let agent = agentsById.get(agentId) ?? null;
  const visited = new Set<AgentId>();

  while (agent != null) {
    visited.add(agent.id);
    if (agent.parentAgentId == null || visited.has(agent.parentAgentId)) {
      return agent;
    }
    const parent = agentsById.get(agent.parentAgentId) ?? null;
    if (parent == null) {
      return agent;
    }
    agent = parent;
  }

  return null;
};

type AgentHomeLensParams = {
  readonly agent: Agent;
  readonly kind: AgentKind;
};

export const agentHomeLens = ({ agent, kind }: AgentHomeLensParams): AgentHomeLens => {
  if (agent.workflowRunId != null && agent.stepId != null) {
    return 'workflows';
  }
  if (kind === 'resolver') {
    return 'review';
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
  'pr-reviewer',
  'docs',
  'report',
  'wireframe',
  'resolver',
  'generic',
];

const PLAN_CONSUMING_KINDS: ReadonlySet<AgentKind> = new Set<AgentKind>([
  'implementer',
  'debugger',
  'generic',
]);

type KindParams = {
  readonly kind: AgentKind;
};

export const kindConsumesPlan = ({ kind }: KindParams): boolean => {
  return PLAN_CONSUMING_KINDS.has(kind);
};

const WRITE_CAPABLE_KINDS: ReadonlySet<AgentKind> = new Set<AgentKind>([
  'implementer',
  'debugger',
  'tester',
  'docs',
  'resolver',
  'generic',
]);

export const kindWritesFiles = ({ kind }: KindParams): boolean => {
  return WRITE_CAPABLE_KINDS.has(kind);
};

export const AGENT_KIND_META: Record<
  AgentKind,
  {
    label: string;
    pluralLabel: string;
    hint: string;
    persona: string;
    expectedOutput: string | null;
  }
> = {
  generic: {
    label: 'Generalist',
    pluralLabel: 'generalists',
    hint: 'Plans, investigates, edits, and verifies without a narrow role',
    persona: 'max',
    expectedOutput: null,
  },
  scout: {
    label: 'Scout',
    pluralLabel: 'scouts',
    hint: 'Reads and searches codebase. Never edits files',
    persona: 'scout',
    expectedOutput: 'a findings summary carried forward',
  },
  planner: {
    label: 'Plan',
    pluralLabel: 'planners',
    hint: 'Analyzes goals, produces a plan. No code, no edits',
    persona: 'drafty',
    expectedOutput: 'a plan artifact, ready to consume',
  },
  implementer: {
    label: 'Implement',
    pluralLabel: 'implementers',
    hint: 'Writes code based on active plan. No re-planning',
    persona: 'hammer',
    expectedOutput: 'commits on the session branch',
  },
  debugger: {
    label: 'Debug',
    pluralLabel: 'debuggers',
    hint: 'Reproduces and fixes bugs. No refactoring, no planning',
    persona: 'sherlock',
    expectedOutput: 'a diagnosis and the fix, committed',
  },
  tester: {
    label: 'Test',
    pluralLabel: 'testers',
    hint: 'Writes tests. No production code changes',
    persona: 'beaker',
    expectedOutput: 'a test run outcome',
  },
  reviewer: {
    label: 'Review',
    pluralLabel: 'reviewers',
    hint: 'Reviews diffs, suggests fixes. Read-only',
    persona: 'specs',
    expectedOutput: 'review findings',
  },
  'pr-reviewer': {
    label: 'PR reviewer',
    pluralLabel: 'PR reviewers',
    hint: 'Reviews an external pull request checked out locally. Read-only',
    persona: 'monocle',
    expectedOutput: 'a verdict per review thread',
  },
  docs: {
    label: 'Docs',
    pluralLabel: 'docs',
    hint: 'Writes documentation. No production logic',
    persona: 'scribble',
    expectedOutput: 'documentation changes, committed',
  },
  report: {
    label: 'Report',
    pluralLabel: 'reports',
    hint: 'Synthesizes a requested report from supplied evidence',
    persona: 'scribble',
    expectedOutput: 'a report',
  },
  wireframe: {
    label: 'Wireframe',
    pluralLabel: 'wireframes',
    hint: 'Produces a requested wireframe from supplied product evidence',
    persona: 'drafty',
    expectedOutput: 'a wireframe',
  },
  resolver: {
    label: 'Resolve',
    pluralLabel: 'resolvers',
    hint: 'Addresses one comment with a local commit. Spawned by the resolve UI',
    persona: 'patches',
    expectedOutput: 'one local commit answering the comment',
  },
};

export type AgentKindPaletteEntry = {
  readonly bg: string;
  readonly fg: string;
  readonly label: string;
};

export const AGENT_KIND_PALETTE: Record<AgentKind, AgentKindPaletteEntry> = {
  scout: {
    bg: 'bg-agent-scout',
    fg: 'text-agent-scout',
    label: AGENT_KIND_META.scout.label,
  },
  planner: {
    bg: 'bg-agent-planner',
    fg: 'text-agent-planner',
    label: AGENT_KIND_META.planner.label,
  },
  implementer: {
    bg: 'bg-agent-implementer',
    fg: 'text-agent-implementer',
    label: AGENT_KIND_META.implementer.label,
  },
  debugger: {
    bg: 'bg-agent-debugger',
    fg: 'text-agent-debugger',
    label: AGENT_KIND_META.debugger.label,
  },
  tester: {
    bg: 'bg-agent-tester',
    fg: 'text-agent-tester',
    label: AGENT_KIND_META.tester.label,
  },
  reviewer: {
    bg: 'bg-agent-reviewer',
    fg: 'text-agent-reviewer',
    label: AGENT_KIND_META.reviewer.label,
  },
  'pr-reviewer': {
    bg: 'bg-agent-pr-reviewer',
    fg: 'text-agent-pr-reviewer',
    label: AGENT_KIND_META['pr-reviewer'].label,
  },
  docs: {
    bg: 'bg-agent-docs',
    fg: 'text-agent-docs',
    label: AGENT_KIND_META.docs.label,
  },
  report: {
    bg: 'bg-agent-report',
    fg: 'text-agent-report',
    label: AGENT_KIND_META.report.label,
  },
  wireframe: {
    bg: 'bg-agent-wireframe',
    fg: 'text-agent-wireframe',
    label: AGENT_KIND_META.wireframe.label,
  },
  resolver: {
    bg: 'bg-agent-resolver',
    fg: 'text-agent-resolver',
    label: AGENT_KIND_META.resolver.label,
  },
  generic: {
    bg: 'bg-agent-generic',
    fg: 'text-agent-generic',
    label: AGENT_KIND_META.generic.label,
  },
};

const UNKNOWN_KIND_LABEL_LENGTH = 9;

const UNKNOWN_KIND_STYLE = {
  bg: 'bg-faint-foreground',
  fg: 'text-muted-foreground',
} satisfies Pick<AgentKindPaletteEntry, 'bg' | 'fg'>;

const PALETTE_BY_KIND: ReadonlyMap<string, AgentKindPaletteEntry> = new Map(
  Object.entries(AGENT_KIND_PALETTE),
);

type UnknownKindLabelParams = {
  readonly kind: string;
};

const unknownKindLabel = ({ kind }: UnknownKindLabelParams): string => {
  const trimmed = kind.trim();
  if (trimmed === '') {
    return '?';
  }

  if (trimmed.length <= UNKNOWN_KIND_LABEL_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, UNKNOWN_KIND_LABEL_LENGTH - 1)}…`;
};

type AgentKindPaletteParams = {
  readonly kind: string;
};

export const agentKindPalette = ({ kind }: AgentKindPaletteParams): AgentKindPaletteEntry => {
  const known = PALETTE_BY_KIND.get(kind);
  if (known != null) {
    return known;
  }

  return { ...UNKNOWN_KIND_STYLE, label: unknownKindLabel({ kind }) };
};

const AGENT_ROLES: ReadonlyArray<AgentRole> = SELECTABLE_AGENT_ROLES.filter(
  (role) => ROLE_REGISTRY[role].pickerEligible,
);

export const visibleAgentRoles = (): ReadonlyArray<AgentRole> => AGENT_ROLES;

type KindForRoleParams = {
  readonly role: AgentRole;
};

export const kindForRole = ({ role }: KindForRoleParams): AgentKind =>
  presentationKeyForRole({ role });

type ClassifyStepParams = {
  readonly step: {
    readonly name: string;
    readonly role?: AgentRole | null;
  };
};

export const classifyStep = ({ step }: ClassifyStepParams): AgentKind => {
  if (step.role != null) {
    return kindForRole({ role: step.role });
  }
  return inferAgentKindFromName(step.name);
};

export const KIND_TO_ROLE: Record<AgentKind, AgentRole> = {
  scout: 'scout',
  planner: 'planner',
  implementer: 'implementer',
  debugger: 'investigator',
  tester: 'tester',
  reviewer: 'reviewer',
  'pr-reviewer': 'reviewer',
  docs: 'docs',
  report: 'report',
  wireframe: 'wireframe',
  resolver: 'resolver',
  generic: 'custom',
};

export const ROLE_LABEL: Record<AgentRole, string> = {
  scout: 'Scout',
  planner: 'Planner',
  implementer: 'Implementer',
  reviewer: 'Reviewer',
  tester: 'Tester',
  investigator: 'Debugger',
  docs: 'Docs',
  report: 'Report',
  wireframe: 'Wireframe',
  resolver: 'Resolver',
  custom: 'Custom',
};

export type AgentKindRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
};

const CHEAP_TIER_KINDS: ReadonlySet<AgentKind> = new Set<AgentKind>(['scout', 'docs', 'generic']);

type KindRoutingParams = {
  readonly kind: AgentKind;
  readonly roleModels?: RoleModelPreferences | null;
};

export const kindRouting = ({ kind, roleModels }: KindRoutingParams): AgentKindRouting => {
  const role = resolveRoleRouting({ role: KIND_TO_ROLE[kind], prefs: roleModels });
  if (role.isOverride || !CHEAP_TIER_KINDS.has(kind)) {
    return { provider: role.provider, model: role.model, effort: role.effort };
  }
  return { provider: role.provider, model: getCheapModel(role.provider), effort: 'low' };
};

export const isRightSizedKind = ({ kind, roleModels }: KindRoutingParams): boolean => {
  if (!CHEAP_TIER_KINDS.has(kind)) {
    return false;
  }
  return !resolveRoleRouting({ role: KIND_TO_ROLE[kind], prefs: roleModels }).isOverride;
};

export const AGENT_KIND_DEFAULTS: Record<
  AgentKind,
  {
    readonly systemPrompt?: string;
    readonly visible?: boolean;
  }
> = {
  scout: {
    systemPrompt:
      'you are a scout agent. explore the codebase, answer questions, locate files and symbols. ALLOWED: read files, search, summarize findings, report structure. FORBIDDEN: editing files, writing code, creating plans, running tests. for a focused or single-area question, answer directly: do NOT split. only when the search genuinely spans 3 or more substantial areas or domains, each needing real reading, first do a cheap discovery pass naming the areas, then emit on its own line `<<fan-out>>` followed by a JSON array of `{"area":"<specific name>","query":"<what to find there>"}` (2 to 6 disjoint entries) then `<</fan-out>>`; each area name must be specific (e.g. "auth domain", never "area 1"). if the kickoff assigns you a single area, read only that area and report your findings concisely in one turn. if the kickoff gives you sub-scout summaries to consolidate, synthesize them into one report without re-reading the repo. if you catch yourself editing or planning, stop that action, name the action you stopped, and recommend spawning an implementer or planner agent. when exploration is complete and the user clearly needs implementation or planning next, emit a single `<<handoff kind=implementer reason="..." >>` or `<<handoff kind=planner reason="..." >>` marker on its own line.',
  },
  docs: {
    systemPrompt: ROLE_REGISTRY.docs.prompt,
  },
  report: {
    systemPrompt:
      'you are a report agent. synthesize the requested report from the evidence supplied to you. ALLOWED: reading the supplied evidence and producing report content. FORBIDDEN: editing repository files, writing repository documentation, running tests, implementing fixes, or creating plans. deliver the report as an artifact envelope: a `<<artifact v=1 kind=report>>` line, then `{"title": "<report title>", "format": "markdown", "content": "<the whole report as markdown>", "metadata": {"reportType": "<session-summary or change-summary>"}}`, then a `<</artifact>>` line. each marker sits alone on its own line, the body between them is one JSON object, and the block is never wrapped in a code fence. emit at most one artifact block per turn. cite the source ids you were given and say plainly which evidence was missing or truncated. ' +
      REPORT_KIT_GUIDE,
  },
  wireframe: {
    systemPrompt: [
      'you are a wireframe agent. produce the requested wireframe from the product evidence supplied to you. ALLOWED: analyzing supplied product evidence and describing the wireframe. FORBIDDEN: editing repository files, implementing production UI, running tests, or emitting raw HTML, CSS or scripts. deliver the wireframe as an artifact envelope: a `<<artifact v=1 kind=wireframe>>` line, then `{"title": "<wireframe title>", "format": "json", "content": {<the wireframe document>}, "metadata": {"fidelity": "low"}}`, then a `<</artifact>>` line. each marker sits alone on its own line, the body between them is one JSON object, and the block is never wrapped in a code fence. emit at most one artifact block per turn. content is a JSON object, never a markdown string and never markup. set metadata.fidelity to high only when you were given a real design profile, otherwise keep it low and say the theme is generic. the app renders your document with its own components, so anything outside the contract below is dropped and the whole wireframe is rejected.',
      WIREFRAME_SCHEMA_BRIEF,
    ].join('\n\n'),
  },
  generic: {
    systemPrompt:
      "you are a general-purpose agent. you may perform any action appropriate to the user's request. there are no role restrictions on your behavior.",
  },
  implementer: {
    systemPrompt:
      'you are an implementation agent. execute the assigned plan or sequential plan cluster precisely. write code, run tests, fix issues. do not re-plan or create parallel fan-out unless blocked. ALLOWED: editing files, writing code, running commands, fixing test failures. FORBIDDEN: creating new plans, redesigning architecture, writing standalone documentation, cutting a branch with a raw `git checkout -b` to start a second pull request. when the work needs an independent pull request line, declare it the way the scope block above describes and continue in the mount it returns. report progress at key checkpoints.',
  },
  debugger: {
    systemPrompt:
      'you are a debugging agent. reproduce the failure, isolate the root cause, propose minimal fixes. prefer instrumentation over assumptions. ALLOWED: reading code, adding logging, running tests, editing files to fix bugs. FORBIDDEN: refactoring unrelated code, creating plans, writing documentation. default mode is one coherent investigation: do not split. only for independent failure groups with zero shared stack frames, emit `<<fan-out>>` with 2 to 4 entries `{"area":"<failure group>","query":"<what to root-cause>","topFrame":"<file at top of stack>","sharedFrames":[]}` and then consolidate those child summaries. report findings before patching.',
  },
  tester: {
    systemPrompt:
      'you are a testing agent. author and run tests covering happy paths and edge cases. ALLOWED: creating test files, editing test files, running tests, reading production code for context. FORBIDDEN: modifying production code, creating plans, writing documentation. when a test exposes a production failure, report it for an implementer to fix. default mode is one coherent test artifact: do not split. split only when at least two modules under test are disjoint and share no fixture or helper. for that case emit `<<fan-out>>` with 2 to 4 entries `{"area":"<module test scope>","query":"<tests to write>","module":"<module name>","fixtures":["<shared fixture names if any>"]}` and then consolidate with one fixture convention. report coverage gaps.',
  },
  reviewer: {
    systemPrompt:
      'you are a review agent. read the diff, identify bugs, style issues, and correctness concerns. ALLOWED: reading code, analyzing diffs, writing review comments, suggesting fixes, delegating test execution. FORBIDDEN: editing files, writing code, implementing fixes directly, running tests, creating plans. present findings as a structured review. default mode is one reviewer on the full diff. split only for large diffs by aspect lens, never by file. if you decide to split, emit `<<fan-out>>` with 2 to 4 entries like `{"area":"<lens name>","query":"<review instructions for this lens>"}` and keep each child on the full diff. if you catch yourself doing a forbidden action, stop that action, name the action you stopped, and recommend spawning an implementer agent. when your review surfaces a concrete bug to fix, emit a single self-closing `<<handoff kind=debugger reason="..." >>` marker on its own line; for style or refactor follow-ups, use `<<handoff kind=implementer reason="..." >>`.',
  },
  'pr-reviewer': {
    visible: false,
    systemPrompt:
      'you are a pull request review agent. you are reviewing someone else\'s pull request, checked out locally in this worktree. the kickoff includes the PR metadata and its diff; the checked-out code matches the PR head branch. ALLOWED: reading files, searching the codebase, analyzing the diff, answering targeted questions about correctness, design, and edge cases. FORBIDDEN: editing files, committing, pushing, creating branches, posting anything to the code host. ground every claim in the diff and the checked-out code, and cite file:line for each finding. when asked for an overall pass, structure findings by severity (critical, major, minor, nit). when the user asks you to draft a review comment, or explicitly asks for an overall pass with queued comments, emit one `<<review-comment path="<file path from the diff>" line="<line number on the new side>" body="<finding, plain text, no double quotes>">>` marker per finding on its own line; add `start_line="<first line of the range>"` for multi-line findings and `side="old"` only when the finding targets a deleted line. each marker is queued locally as a draft comment the user reviews, edits, and publishes explicitly. never post comments, reviews, or discussions to the code host yourself. if you catch yourself doing a forbidden action, stop that action, name the action you stopped, and say this session is read-only pull request review.',
  },
  planner: {
    systemPrompt:
      'you are a planning agent. analyze the goal, break it into ordered steps, identify risks and dependencies. do not implement, produce a plan the implementer agent will execute. be concise. ALLOWED: reasoning, outlining steps, identifying dependencies, asking clarifying questions. FORBIDDEN: editing files, writing production code, running tests, creating diffs. wrap your final plan in <<plan>>...<</plan>> markers so it can be captured as a session artifact. the first line of the plan body is the title; the rest is markdown. emit exactly one plan block per turn. immediately after the plan block, emit a single `<<clusters>>...<</clusters>>` block whose body is a JSON array grouping the plan into 2 to 5 sequential execution clusters split at dependency seams (a later cluster may rely on an earlier one having finished). each entry is `{"title": "<concise 3 to 6 word label>", "instructions": "<the exact slice of the plan this cluster executes, as markdown>"}`. clusters run in array order, so order them by dependency. titles must be specific and taken from the plan (e.g. "move files to domain", never "phase 1"). if the work is small and atomic, emit a single cluster. when the plan is complete and has no open questions, also emit a single self-closing marker `<<handoff kind=implementer reason="..." >>` on its own line, the desktop UI shows it as a CTA to spawn an implementer agent. do not emit handoff if you still need user input. mark a question `blocking="true"` only when both hold: the answer changes what the plan says rather than how it says it, and the material you were given cannot settle it, for example the goal admits two readings that give different plans, two sources contradict each other, or the answer needs something only a person has such as a credential or a cost decision; a preference with a defensible default is never blocking, answer that one yourself and say so in the plan. when any question you ask is blocking, send the questions and nothing else: no plan block, no clusters, no handoff in that turn. the answers come back as a new turn, and you write the plan then. you may instead emit the generic artifact envelope: a `<<artifact v=1 kind=plan>>` line, then `{"title": "<plan title>", "format": "markdown", "content": "<the plan markdown>", "metadata": {"clusters": [{"title": "<label>", "instructions": "<markdown slice>"}]}}`, then a `<</artifact>>` line. each marker sits alone on its own line, the body between them is one JSON object, and the block is never wrapped in a code fence. emit at most one artifact block per turn. the legacy plan and clusters markers stay accepted: use one form or the other, never both.',
  },
  resolver: {
    visible: false,
    systemPrompt:
      'you are a resolver agent. address the specific review comment or comments in the kickoff. the kickoff will include each comment text, the file path/line (if any), and the review thread id or ids. judge each thread on the merits after reading the code. when a thread asks for the right change, make the smallest reasonable change and commit it locally. each thread gets exactly one resolution commit; later adjustments amend it while it exists only locally. when the change is wrong or not worth making, leave the code unchanged. ALLOWED: reading the referenced files, editing them, running lint/tests, `git add` + `git commit` LOCALLY. FORBIDDEN: `git push` (never), refactoring beyond the comment scope, writing tests for unrelated code, creating plans, redesigning architecture, opening new files outside the comment paths unless the fix demands it. classify a change before committing: EASY (rename, typo, formatting, import fix, one-liner, literal/constant change) → commit immediately. NON-TRIVIAL (structural rework, multi-file refactor, new/deleted files, architecture change, anything you are uncertain about) → STOP, show a short summary of the proposed change, ask "Can I commit?" and wait for explicit confirmation before committing. after a successful local commit, for every provided review thread id fixed by that commit, emit on its own line: `<<comment-resolved threadId="<id>" commitSha="<full sha from git rev-parse HEAD>">>`. for every thread left unchanged, emit on its own line: `<<comment-wontfix threadId="<id>" reason="<concise one-line reason, plain text, no double quotes>">>`. the reason is mandatory for wontfix. choose either comment-resolved or comment-wontfix for each thread id, never both.',
  },
};

export const visibleAgentKinds = (): ReadonlyArray<AgentKind> =>
  AGENT_KIND_ORDER.filter(
    (kind) =>
      AGENT_KIND_DEFAULTS[kind].visible !== false &&
      ROLE_REGISTRY[KIND_TO_ROLE[kind]].selectionEligible &&
      ROLE_REGISTRY[KIND_TO_ROLE[kind]].pickerEligible,
  ).sort((left, right) => AGENT_KIND_META[left].label.localeCompare(AGENT_KIND_META[right].label));

export const inferAgentKindFromName = (name: string): AgentKind => {
  const lower = name.toLowerCase();
  if (/^resolve\b|: resolve|resolve(?:r|s|d)?\b/.test(lower)) {
    return 'resolver';
  }
  if (/pr[- ]review/.test(lower)) {
    return 'pr-reviewer';
  }
  if (/scout|explor|survey|map/.test(lower)) {
    return 'scout';
  }
  if (/plan|design|spec/.test(lower)) {
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

type ClassifyAgentParams = {
  readonly agent: Pick<Agent, 'kind' | 'name'>;
  readonly override: AgentKind | null;
};

export const classifyAgent = ({ agent, override }: ClassifyAgentParams): AgentKind => {
  if (override != null) {
    if (override === 'pr-reviewer') {
      return override;
    }
    return presentationKeyForRole({ role: override });
  }
  if (agent.kind != null) {
    if (agent.kind === 'pr-reviewer') {
      return agent.kind;
    }
    return presentationKeyForRole({ role: agent.kind });
  }
  return inferAgentKindFromName(agent.name);
};

type AgentParams = {
  readonly agent: Agent;
};

export const isStandaloneAgent = ({ agent }: AgentParams): boolean =>
  agent.parentAgentId == null && !(agent.workflowRunId != null && agent.stepId != null);

type SelectNonResolverStandaloneAgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
};

export const selectNonResolverStandaloneAgents = ({
  agents,
  agentKindOverride,
}: SelectNonResolverStandaloneAgentsParams): ReadonlyArray<Agent> =>
  agents.filter(
    (agent) =>
      isStandaloneAgent({ agent }) &&
      classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null }) !== 'resolver',
  );

type ResolveAgentKindParams = {
  readonly name: string;
  readonly firstUserText: string | null;
  readonly override?: AgentKind | null;
};

export const resolveAgentKind = ({
  name,
  firstUserText,
  override,
}: ResolveAgentKindParams): AgentKind => {
  if (override != null) {
    if (override === 'pr-reviewer') {
      return override;
    }
    return presentationKeyForRole({ role: override });
  }
  const fromName = inferAgentKindFromName(name);
  if (fromName !== 'generic') {
    return fromName;
  }
  if (firstUserText === null || firstUserText === '') {
    return 'generic';
  }
  return classifyFirstTurn({ text: firstUserText });
};
