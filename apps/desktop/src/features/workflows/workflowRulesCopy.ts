import type { ProviderPolicy, WorkflowRules } from '@goodboy/types';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import { RUN_AUTONOMY_OPTIONS } from './runAutonomy';

const capAmount = ({ usd }: { readonly usd: number }): string =>
  Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;

export const autonomyLabel = ({ rules }: { readonly rules: WorkflowRules }): string =>
  RUN_AUTONOMY_OPTIONS.find((option) => option.key === rules.autonomy)?.label ??
  'Ask before each step';

export const spendRuleText = ({ rules }: { readonly rules: WorkflowRules }): string =>
  rules.spendLimitUsd === null
    ? 'No spend cap'
    : `${capAmount({ usd: rules.spendLimitUsd })} cap, ${rules.spendLimitMode === 'pause' ? 'pause' : 'warn'}`;

export const guidanceRuleText = ({ rules }: { readonly rules: WorkflowRules }): string =>
  rules.standingGuidance.trim() === '' ? 'No guidance' : 'Guidance set';

export const workflowRulesSummary = ({ rules }: { readonly rules: WorkflowRules }): string =>
  [autonomyLabel({ rules }), spendRuleText({ rules }), guidanceRuleText({ rules })].join(' · ');

export const policyProvidersText = ({
  policy,
}: {
  readonly policy: ProviderPolicy | null | undefined;
}): string =>
  (policy ?? [])
    .filter((entry) => entry.state === 'on')
    .map((entry) => PROVIDER_LABEL[entry.id])
    .join(', ');

export const canonicalWorkflowRules = ({ rules }: { readonly rules: WorkflowRules }): string =>
  JSON.stringify({
    autonomy: rules.autonomy,
    spendLimitUsd: rules.spendLimitUsd,
    spendLimitMode: rules.spendLimitMode,
    spreadByHeadroom: rules.spreadByHeadroom,
    standingGuidance: rules.standingGuidance,
    guidanceRoles: rules.guidanceRoles,
  });
