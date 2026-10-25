import { useState } from 'react';
import type { PermissionRule, ProviderId } from '@goodboy/types';
import { Button, cn, tintClasses } from '@goodboy/ui';
import { describeRule } from '../../utils/describeRule';
import { RuleProviderChips } from './RuleProviderChips';

type Props = {
  readonly rule: PermissionRule;
  readonly activeProviders: ReadonlyArray<ProviderId>;
  readonly onRemove: (rule: PermissionRule) => Promise<void>;
};

const DECISION_COPY = {
  allow: { glyph: '✓', word: 'Allow', tone: 'success' },
  deny: { glyph: '✕', word: 'Deny', tone: 'danger' },
  ask: { glyph: '?', word: 'Ask', tone: 'info' },
} as const;

export const RuleRow = ({ rule, activeProviders, onRemove }: Props) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const decision = DECISION_COPY[rule.decision];
  const what = describeRule({ pattern: rule.pattern });
  const where = rule.scope === 'global' ? 'All workspaces' : 'This workspace';

  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2">
      <span
        className={cn(
          'inline-flex w-14 shrink-0 items-center gap-1 text-meta',
          tintClasses(decision.tone).text,
        )}
      >
        <span aria-hidden>{decision.glyph}</span>
        {decision.word}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-meta text-foreground">{what}</span>
        <RuleProviderChips rule={rule} activeProviders={activeProviders} />
      </span>
      <span className="shrink-0 text-meta text-muted-foreground">{where}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Remove rule: ${what}`}
        disabled={isRemoving}
        onClick={async () => {
          setIsRemoving(true);
          try {
            await onRemove(rule);
          } finally {
            setIsRemoving(false);
          }
        }}
      >
        Remove
      </Button>
    </div>
  );
};
