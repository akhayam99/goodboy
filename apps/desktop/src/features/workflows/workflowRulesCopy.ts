import type { WorkflowRules } from '@goodboy/types';
import { RUN_AUTONOMY_OPTIONS } from './runAutonomy';

const capAmount = ({ usd }: { readonly usd: number }): string =>
  Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;

const autonomyLabel = ({ rules }: { readonly rules: WorkflowRules }): string =>
  RUN_AUTONOMY_OPTIONS.find((option) => option.key === rules.autonomy)?.label ??
  'Ask before each step';

const spendRuleText = ({ rules }: { readonly rules: WorkflowRules }): string =>
  rules.spendLimitUsd === null
    ? 'No spend cap'
    : `${capAmount({ usd: rules.spendLimitUsd })} cap, ${rules.spendLimitMode === 'pause' ? 'pause' : 'warn'}`;

const guidanceRuleText = ({ rules }: { readonly rules: WorkflowRules }): string =>
  rules.standingGuidance.trim() === '' ? 'No guidance' : 'Guidance set';

export const workflowRulesSummary = ({ rules }: { readonly rules: WorkflowRules }): string =>
  [autonomyLabel({ rules }), spendRuleText({ rules }), guidanceRuleText({ rules })].join(' · ');

export const canonicalWorkflowRules = ({ rules }: { readonly rules: WorkflowRules }): string =>
  JSON.stringify({
    autonomy: rules.autonomy,
    spendLimitUsd: rules.spendLimitUsd,
    spendLimitMode: rules.spendLimitMode,
    spreadByHeadroom: rules.spreadByHeadroom,
    standingGuidance: rules.standingGuidance,
    guidanceRoles: rules.guidanceRoles,
  });
