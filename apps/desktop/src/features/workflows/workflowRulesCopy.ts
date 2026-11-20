import type { WorkflowRules } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import { RUN_AUTONOMY_OPTIONS } from './runAutonomy';

type AmountParams = {
  readonly usd: number;
};

type RulesParams = {
  readonly rules: WorkflowRules;
};

const capAmount = ({ usd }: AmountParams): string =>
  Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;

const autonomyLabel = ({ rules }: RulesParams): string =>
  RUN_AUTONOMY_OPTIONS.find((option) => option.key === rules.autonomy)?.label ?? NAMES.everyStep;

const spendRuleText = ({ rules }: RulesParams): string =>
  rules.spendLimitUsd === null
    ? 'No limit'
    : `${capAmount({ usd: rules.spendLimitUsd })} limit, ${rules.spendLimitMode === 'pause' ? 'pause' : 'warn'}`;

const guidanceRuleText = ({ rules }: RulesParams): string =>
  rules.standingGuidance.trim() === '' ? 'No guidance' : 'Guidance set';

export const workflowRulesSummary = ({ rules }: RulesParams): string =>
  [autonomyLabel({ rules }), spendRuleText({ rules }), guidanceRuleText({ rules })].join(' · ');

export const canonicalWorkflowRules = ({ rules }: RulesParams): string =>
  JSON.stringify({
    autonomy: rules.autonomy,
    spendLimitUsd: rules.spendLimitUsd,
    spendLimitMode: rules.spendLimitMode,
    spreadByHeadroom: rules.spreadByHeadroom,
    standingGuidance: rules.standingGuidance,
    guidanceRoles: rules.guidanceRoles,
    ...(rules.canOrchestratorPickModel === true && { canOrchestratorPickModel: true }),
  });
