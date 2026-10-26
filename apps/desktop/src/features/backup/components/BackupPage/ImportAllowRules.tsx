import { Checkbox } from '@goodboy/ui';
import type { AllowRulePreview } from '@goodboy/types';
import type { WildcardConsentParams } from '../../wildcardConsent';

type Props = {
  readonly rules: ReadonlyArray<AllowRulePreview>;
  readonly hasWildcardConsent: boolean;
  readonly onWildcardConsentChange: (params: WildcardConsentParams) => void;
  readonly isDisabled: boolean;
};

type RuleLabelParams = {
  readonly rule: AllowRulePreview;
};

const ruleLabel = ({ rule }: RuleLabelParams): string =>
  rule.patternArgsMatcher === null || rule.patternArgsMatcher.length === 0
    ? rule.patternTool
    : `${rule.patternTool}(${rule.patternArgsMatcher})`;

export const ImportAllowRules = ({
  rules,
  hasWildcardConsent,
  onWildcardConsentChange,
  isDisabled,
}: Props) => {
  if (rules.length === 0) {
    return null;
  }
  const wildcardCount = rules.filter((rule) => rule.isWildcard).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta text-muted-foreground">
        This file lets agents run these without asking.
      </p>
      <ul className="flex flex-col gap-1">
        {rules.map((rule) => (
          <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 text-meta">
            <code className="text-foreground">{ruleLabel({ rule })}</code>
            <span className="text-meta text-faint-foreground">
              {rule.replacesDecision === null
                ? rule.scope
                : `${rule.scope}, replaces a ${rule.replacesDecision} rule`}
              {rule.isWildcard ? ', matches anything' : ''}
            </span>
          </li>
        ))}
      </ul>
      {wildcardCount > 0 && (
        <Checkbox
          label={
            <span className="text-meta text-foreground">
              Let{' '}
              {wildcardCount === 1
                ? 'the rule that matches anything'
                : 'the rules that match anything'}{' '}
              run without asking
            </span>
          }
          checked={hasWildcardConsent}
          disabled={isDisabled}
          onChange={(isChecked) => onWildcardConsentChange({ isAccepted: isChecked })}
        />
      )}
    </div>
  );
};
