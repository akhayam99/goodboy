import {
  parsePlanChangeRequest,
  parsePlanChanges,
  parseRunPreset,
  type PlanChange,
  type PlanChangeRequest,
  type RunPreset,
} from './run-preset';
import { parseRunRoute, type RunRoute } from './run-route';
import type { AgentRole } from './workflow';
import { isRecord } from './helpers';

type RouteParams = {
  readonly value: unknown;
};

const routeOf = ({ value }: RouteParams): Readonly<{ route: RunRoute }> | null => {
  const route = parseRunRoute({ value });
  return route === null ? null : { route };
};

type PresetPartsParams = {
  readonly value: Readonly<Record<string, unknown>>;
};

type PresetParts = Readonly<{
  preset?: RunPreset;
  planChanges?: ReadonlyArray<PlanChange>;
  pendingChange?: PlanChangeRequest;
  approvedChange?: PlanChangeRequest;
}>;

const presetPartsOf = ({ value }: PresetPartsParams): PresetParts => {
  const preset = parseRunPreset({ value: value.preset });
  const planChanges = parsePlanChanges({ value: value.planChanges });
  const pendingChange = parsePlanChangeRequest({ value: value.pendingChange });
  const approvedChange = parsePlanChangeRequest({ value: value.approvedChange });
  return {
    ...(preset !== null && { preset }),
    ...(planChanges.length > 0 && { planChanges }),
    ...(pendingChange !== null && { pendingChange }),
    ...(approvedChange !== null && { approvedChange }),
  };
};

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
  canOrchestratorPickModel?: boolean;
  route?: RunRoute;
  preset?: RunPreset;
  planChanges?: ReadonlyArray<PlanChange>;
  pendingChange?: PlanChangeRequest;
  approvedChange?: PlanChangeRequest;
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
  'ci-debugger',
  'ci-fixer',
  'docs',
  'report',
  'wireframe',
  'custom',
];

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
    ...(value.canOrchestratorPickModel === true && { canOrchestratorPickModel: true }),
    ...(routeOf({ value: value.route }) ?? {}),
    ...presetPartsOf({ value }),
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
