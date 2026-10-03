import type { AgentRole } from './workflow';

export const WORKFLOW_AUTONOMY_VALUES = ['step', 'plan', 'run'] as const;

export type WorkflowAutonomy = (typeof WORKFLOW_AUTONOMY_VALUES)[number];

export type WorkflowRulesSpendMode = 'notify' | 'pause';

export type WorkflowRules = Readonly<{
  autonomy: WorkflowAutonomy;
  spendLimitUsd: number | null;
  spendLimitMode: WorkflowRulesSpendMode;
  spreadByHeadroom: boolean;
  standingGuidance: string;
  guidanceRoles: ReadonlyArray<AgentRole>;
  planApproved?: boolean;
}>;

export const DEFAULT_WORKFLOW_RULES: WorkflowRules = {
  autonomy: 'step',
  spendLimitUsd: null,
  spendLimitMode: 'pause',
  spreadByHeadroom: true,
  standingGuidance: '',
  guidanceRoles: ['implementer', 'docs'],
};

const GUIDANCE_ROLES: ReadonlyArray<AgentRole> = [
  'scout',
  'planner',
  'implementer',
  'reviewer',
  'investigator',
  'tester',
  'resolver',
  'rewriter',
  'scribe',
  'docs',
  'report',
  'wireframe',
  'custom',
];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const autonomyOf = (value: unknown): WorkflowAutonomy =>
  WORKFLOW_AUTONOMY_VALUES.find((candidate) => candidate === value) ??
  DEFAULT_WORKFLOW_RULES.autonomy;

const spendLimitOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

const spendModeOf = (value: unknown): WorkflowRulesSpendMode =>
  value === 'notify' ? 'notify' : 'pause';

const rolesOf = (value: unknown): ReadonlyArray<AgentRole> => {
  if (!Array.isArray(value)) {
    return DEFAULT_WORKFLOW_RULES.guidanceRoles;
  }
  return GUIDANCE_ROLES.filter((role) => value.includes(role));
};

export const parseWorkflowRules = ({
  value,
}: {
  readonly value: unknown;
}): WorkflowRules | null => {
  if (!isRecord(value)) {
    return null;
  }
  return {
    autonomy: autonomyOf(value.autonomy),
    spendLimitUsd: spendLimitOf(value.spendLimitUsd),
    spendLimitMode: spendModeOf(value.spendLimitMode),
    spreadByHeadroom:
      typeof value.spreadByHeadroom === 'boolean'
        ? value.spreadByHeadroom
        : DEFAULT_WORKFLOW_RULES.spreadByHeadroom,
    standingGuidance: typeof value.standingGuidance === 'string' ? value.standingGuidance : '',
    guidanceRoles: rolesOf(value.guidanceRoles),
    ...(value.planApproved === true && { planApproved: true }),
  };
};

export const parseWorkflowRulesText = ({
  text,
}: {
  readonly text: string | null | undefined;
}): WorkflowRules | null => {
  if (text == null || text === '') {
    return null;
  }
  try {
    return parseWorkflowRules({ value: JSON.parse(text) });
  } catch {
    return null;
  }
};
