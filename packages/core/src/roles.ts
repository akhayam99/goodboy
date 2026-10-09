import type { AgentRole, WorkflowTaskType } from '@goodboy/types';
import { devWarn } from './dev-log';

export type { AgentEffort, AgentRole } from '@goodboy/types';

export type RoleExplain = {
  readonly does: string;
  readonly autoReason: string;
  readonly splitNote: string;
  readonly launchNote: string | null;
};

export type RoleDefaults = {
  readonly description: string;
  readonly summary: string;
  readonly fanOut: RoleFanOutCapability;
  readonly explain: RoleExplain;
  readonly prompt?: string;
};

export type RoleOutputKind = 'none' | 'plan' | 'report' | 'wireframe';

export type RolePresentationKey =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'debugger'
  | 'tester'
  | 'resolver'
  | 'rewriter'
  | 'scribe'
  | 'docs'
  | 'report'
  | 'wireframe'
  | 'generic';

export type RoleRegistryEntry = RoleDefaults & {
  readonly id: AgentRole;
  readonly aliases: ReadonlyArray<string>;
  readonly presentationKey: RolePresentationKey;
  readonly defaultRoutingTaskType: WorkflowTaskType;
  readonly outputKind: RoleOutputKind;
  readonly workflowEligible: boolean;
  readonly classifierEligible: boolean;
  readonly selectionEligible: boolean;
  readonly pickerEligible: boolean;
};

export type RoleFanOutMode = 'natural' | 'conditional' | 'never';

export type RoleFanOutPartitionKey =
  'codebase-area' | 'diff-aspect' | 'module-under-test' | 'top-stack-file' | null;

export type RoleFanOutCapability = {
  readonly mode: RoleFanOutMode;
  readonly partitionKey: RoleFanOutPartitionKey;
  readonly condition: string | null;
};

export const ROLE_REGISTRY = {
  scout: {
    id: 'scout',
    summary: 'Finds the files, callers and tests that matter. Never edits.',
    aliases: [],
    presentationKey: 'scout',
    defaultRoutingTaskType: 'exploration',
    outputKind: 'none',
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    description: 'survey code, list relevant files, identify abstractions; no changes',
    explain: {
      does: 'Surveys code, lists the relevant files and abstractions. Makes no changes.',
      autoReason:
        'Light model. Reading code is cheap and splits by area, so several small runs beat one big one.',
      splitNote: 'Splits by codebase area when the area is wide.',
      launchNote: null,
    },
    fanOut: {
      mode: 'natural',
      partitionKey: 'codebase-area',
      condition: null,
    },
  },
  investigator: {
    id: 'investigator',
    summary: 'Reproduces a failure and finds its root cause.',
    aliases: ['debugger'],
    presentationKey: 'debugger',
    defaultRoutingTaskType: 'debugging',
    outputKind: 'none',
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    description: 'reproduce, diagnose, root-cause, patch the failure',
    explain: {
      does: 'Reproduces the failure, diagnoses it and patches the cause.',
      autoReason:
        'High effort. A root cause needs long, careful reasoning more than a bigger model.',
      splitNote: 'Only for independent failures grouped by top stack file, with no shared frames.',
      launchNote: null,
    },
    fanOut: {
      mode: 'conditional',
      partitionKey: 'top-stack-file',
      condition: 'only for independent failures grouped by top stack file with no shared frames',
    },
  },
  planner: {
    id: 'planner',
    summary: 'Turns a goal into an ordered plan.',
    aliases: [],
    presentationKey: 'planner',
    defaultRoutingTaskType: 'planning',
    outputKind: 'plan',
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    description: 'design the change; produce an ordered plan',
    explain: {
      does: 'Designs the change and writes an ordered plan.',
      autoReason: 'Strongest model. A weak plan costs every step that follows it.',
      splitNote: 'It works as one agent, so the plan stays coherent.',
      launchNote: 'Nothing. It hands the plan to the steps that follow.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  implementer: {
    id: 'implementer',
    summary: 'Writes the code for one part of the plan.',
    aliases: [],
    presentationKey: 'implementer',
    defaultRoutingTaskType: 'implementation',
    outputKind: 'none',
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    description: 'apply one assigned plan or sequential cluster in small commits',
    explain: {
      does: 'Applies one assigned plan or one sequential cluster, in small commits.',
      autoReason: 'Medium effort. Writes code in small commits and needs care, not the top tier.',
      splitNote: 'Parts of a plan run as separate steps, not as children.',
      launchNote: 'Nothing. Tests are delegated to the Tester step.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  reviewer: {
    id: 'reviewer',
    summary: 'Reads the diff and reports problems. Never edits code.',
    aliases: [],
    presentationKey: 'reviewer',
    defaultRoutingTaskType: 'review',
    outputKind: 'none',
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    description: 'audit the diff read-only, delegate test execution, flag drift',
    explain: {
      does: 'Audits the diff read-only and flags drift from the plan.',
      autoReason: 'High effort. It has to catch what the writer missed, and it only reads.',
      splitNote: 'Only when more than 15 files changed or the diff is over 800 lines.',
      launchNote: null,
    },
    fanOut: {
      mode: 'conditional',
      partitionKey: 'diff-aspect',
      condition: 'only when changed files are over 15 or diff lines are over 800',
    },
  },
  tester: {
    id: 'tester',
    summary: 'Writes and runs tests, reports failures.',
    aliases: [],
    presentationKey: 'tester',
    defaultRoutingTaskType: 'testing',
    outputKind: 'none',
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    description: 'author and run tests; report production failures for an implementer',
    explain: {
      does: 'Authors and runs tests, and reports production failures.',
      autoReason: 'Medium effort. Test code is routine, and a failure goes back to an Implementer.',
      splitNote: 'Only when at least two disjoint modules can be tested without shared fixtures.',
      launchNote: null,
    },
    fanOut: {
      mode: 'conditional',
      partitionKey: 'module-under-test',
      condition:
        'only when at least two disjoint modules can be tested without shared fixtures or helpers',
    },
  },
  resolver: {
    id: 'resolver',
    summary: 'Answers one review comment with one commit.',
    aliases: [],
    presentationKey: 'resolver',
    defaultRoutingTaskType: 'implementation',
    outputKind: 'none',
    workflowEligible: false,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: true,
    description: 'address a review comment with one local commit',
    explain: {
      does: 'Addresses one review comment with one local commit.',
      autoReason:
        'Medium effort. One comment, one commit: small scope, so a mid-size model is enough.',
      splitNote: 'One comment is one run.',
      launchNote: 'Nothing.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  rewriter: {
    id: 'rewriter',
    summary: 'Replays a history plan in a throwaway copy and settles its conflicts.',
    aliases: ['history rewriter'],
    presentationKey: 'rewriter',
    defaultRoutingTaskType: 'implementation',
    outputKind: 'none',
    workflowEligible: false,
    classifierEligible: false,
    selectionEligible: false,
    pickerEligible: false,
    description: 'replay a branch history plan in a copy and merge the conflicting edits',
    explain: {
      does: 'Replays a history plan in a throwaway copy and settles the conflicts.',
      autoReason:
        'Balanced model. Conflicts need judgment, but the plan already says what goes where.',
      splitNote: 'One history plan is one run.',
      launchNote: 'Nothing.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  scribe: {
    id: 'scribe',
    summary:
      'Writes text about the code, never the code: pull requests, commit messages, changelog.',
    aliases: [],
    presentationKey: 'scribe',
    defaultRoutingTaskType: 'writing',
    outputKind: 'none',
    workflowEligible: false,
    classifierEligible: false,
    selectionEligible: false,
    pickerEligible: false,
    description: 'write pull request text, commit messages and changelog entries from the diff',
    explain: {
      does: 'Writes pull request text, commit messages and changelog entries from the diff.',
      autoReason: 'Balanced model. It writes from the diff, so it needs clarity more than depth.',
      splitNote: 'One text is one run.',
      launchNote: 'Nothing.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  docs: {
    id: 'docs',
    summary: 'Updates repository documentation.',
    aliases: ['writer'],
    presentationKey: 'docs',
    defaultRoutingTaskType: 'writing',
    outputKind: 'none',
    workflowEligible: true,
    classifierEligible: true,
    selectionEligible: true,
    pickerEligible: true,
    description: 'write repository documentation only, never reports',
    prompt:
      'you are a repository documentation agent. write and update repository documentation, READMEs, changelogs, and docstrings. never produce session reports or other report artifacts. ALLOWED: editing documentation files and documentation text. FORBIDDEN: editing production logic, writing tests, implementing features, creating plans, or writing reports.',
    explain: {
      does: 'Writes and updates repository documentation. Never writes reports.',
      autoReason: 'Low effort. The docs follow code that has already changed.',
      splitNote: 'One pass over the docs is one run.',
      launchNote: 'Nothing.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  report: {
    id: 'report',
    summary: 'Writes a report you asked for from the evidence.',
    aliases: [],
    presentationKey: 'report',
    defaultRoutingTaskType: 'writing',
    outputKind: 'report',
    workflowEligible: true,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: false,
    description: 'produce a requested report from supplied evidence',
    explain: {
      does: 'Writes the report you asked for from the evidence it is given.',
      autoReason: 'Medium effort. It turns evidence into prose, it does not search for it.',
      splitNote: 'One report is one run.',
      launchNote: 'Nothing.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  wireframe: {
    id: 'wireframe',
    summary: 'Draws a wireframe from product evidence.',
    aliases: [],
    presentationKey: 'wireframe',
    defaultRoutingTaskType: 'planning',
    outputKind: 'wireframe',
    workflowEligible: true,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: false,
    description: 'produce a requested wireframe from supplied product evidence',
    explain: {
      does: 'Draws a wireframe from the product evidence it is given.',
      autoReason: 'Medium effort. The evidence sets the layout, the model draws it.',
      splitNote: 'One wireframe is one run.',
      launchNote: 'Nothing.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
  custom: {
    id: 'custom',
    summary: 'Any agent you start without a role.',
    aliases: ['generic'],
    presentationKey: 'generic',
    defaultRoutingTaskType: 'general',
    outputKind: 'none',
    workflowEligible: true,
    classifierEligible: false,
    selectionEligible: true,
    pickerEligible: true,
    description: 'user-defined role',
    explain: {
      does: 'Any agent you start without a role.',
      autoReason: 'Medium effort. A safe middle when the job is not known ahead.',
      splitNote: 'Never splits. Pick a role when an agent should split its work.',
      launchNote: 'Nothing.',
    },
    fanOut: {
      mode: 'never',
      partitionKey: null,
      condition: null,
    },
  },
} as const satisfies Readonly<Record<AgentRole, RoleRegistryEntry>>;

const ROLE_ENTRIES: ReadonlyArray<RoleRegistryEntry> = Object.values(ROLE_REGISTRY);

export const SELECTABLE_AGENT_ROLES: ReadonlyArray<AgentRole> = ROLE_ENTRIES.filter(
  (entry) => entry.selectionEligible,
).map((entry) => entry.id);

const roleEntryForInput = (role: string): RoleRegistryEntry | null => {
  const candidate = role.trim().toLowerCase();
  return (
    ROLE_ENTRIES.find(
      (entry) =>
        entry.id === candidate ||
        entry.presentationKey === candidate ||
        entry.aliases.includes(candidate),
    ) ?? null
  );
};

export const isAgentRole = (role: string): role is AgentRole => {
  return ROLE_ENTRIES.some((entry) => entry.id === role);
};

type NormalizeAgentRoleParams = {
  readonly role: string | undefined;
};

export const normalizeAgentRole = ({ role }: NormalizeAgentRoleParams): AgentRole => {
  if (role == null) {
    devWarn('[roles] missing role; using custom');
    return 'custom';
  }
  const entry = roleEntryForInput(role);
  if (entry !== null) {
    return entry.id;
  }
  devWarn(`[roles] unknown role ${JSON.stringify(role)}; using custom`);
  return 'custom';
};

export const normalizeSelectableAgentRole = ({ role }: NormalizeAgentRoleParams): AgentRole => {
  const normalized = normalizeAgentRole({ role });
  if (ROLE_REGISTRY[normalized].selectionEligible) {
    return normalized;
  }
  return 'custom';
};

export const normalizeWorkflowRole = ({ role }: NormalizeAgentRoleParams): AgentRole => {
  const normalized = normalizeAgentRole({ role });
  if (normalized === 'resolver') {
    return 'implementer';
  }
  return normalizeSelectableAgentRole({ role: normalized });
};

export const presentationKeyForRole = ({ role }: NormalizeAgentRoleParams): RolePresentationKey =>
  ROLE_REGISTRY[normalizeAgentRole({ role })].presentationKey;

export const defaultsForRole = (role: string): RoleDefaults => {
  return ROLE_REGISTRY[normalizeAgentRole({ role })];
};

export const fanOutCapabilityForRole = (role: string): RoleFanOutCapability => {
  return defaultsForRole(role).fanOut;
};

export const SCOUT_DEPTH_CAP = 2;
export const FAN_OUT_DEPTH_CAP = 1;
export const FAN_OUT_MAX_CHILDREN = 4;

export type RoleSplitLimits = {
  readonly maxChildren: number;
  readonly levels: number;
};

export const fanOutDepthCapForRole = (role: string): number =>
  normalizeAgentRole({ role }) === 'scout' ? SCOUT_DEPTH_CAP : FAN_OUT_DEPTH_CAP;

export const roleSplitLimits = (role: string): RoleSplitLimits | null => {
  if (fanOutCapabilityForRole(role).mode === 'never') {
    return null;
  }
  return { maxChildren: FAN_OUT_MAX_CHILDREN, levels: fanOutDepthCapForRole(role) };
};
