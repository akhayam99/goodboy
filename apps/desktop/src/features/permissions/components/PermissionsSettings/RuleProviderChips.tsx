import type { PermissionRule, ProviderId } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { RULE_PROVIDERS, splitRuleProviders } from '../../utils/providerSupport';

type Props = {
  readonly rule: PermissionRule;
  readonly activeProviders: ReadonlyArray<ProviderId>;
};

type IgnoreCopyParams = {
  readonly rule: PermissionRule;
  readonly names: string;
};

const ignoreCopy = ({ rule, names }: IgnoreCopyParams): string => {
  if (rule.decision !== 'deny') {
    return `${names} ignore it`;
  }
  if (rule.pattern.tool === 'Bash') {
    return `${names} can still run it`;
  }
  return `${names} can still do it`;
};

export const RuleProviderChips = ({ rule, activeProviders }: Props) => {
  const { ignorers } = splitRuleProviders({ providers: activeProviders });
  const names =
    ignorers.length === 0
      ? 'Other providers'
      : ignorers.map((provider) => PROVIDER_LABEL[provider]).join(', ');
  const isDeny = rule.decision === 'deny';
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1 text-meta">
      <span className={cn('inline-flex items-center gap-1', tintClasses('success').text)}>
        <span aria-hidden>✓</span>
        {RULE_PROVIDERS.map((provider) => PROVIDER_LABEL[provider]).join(', ')}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1',
          isDeny && ignorers.length > 0 ? tintClasses('warning').text : 'text-muted-foreground',
        )}
      >
        <span aria-hidden>{isDeny ? '⚠' : '✕'}</span>
        {ignoreCopy({ rule, names })}
      </span>
    </span>
  );
};
