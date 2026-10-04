import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { PermissionRule, ProviderId } from '@goodboy/types';
import { Button, InlineConfirm, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const decision = DECISION_COPY[rule.decision];
  const what = describeRule({ pattern: rule.pattern });
  const where = rule.scope === 'global' ? 'All workspaces' : 'This workspace';

  if (isConfirming) {
    return (
      <InlineConfirm
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title={`Remove "${decision.word}: ${what}"?`}
        description="Agents follow the mode alone from the next turn."
        confirmLabel="Remove"
        isBusy={isRemoving}
        onConfirm={async () => {
          setIsRemoving(true);
          try {
            await onRemove(rule);
          } finally {
            setIsRemoving(false);
            setIsConfirming(false);
          }
        }}
        onCancel={() => setIsConfirming(false)}
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2">
      <span
        className={cn(
          'inline-flex w-14 shrink-0 items-center gap-1 text-label',
          tintClasses(decision.tone).text,
        )}
      >
        <span aria-hidden>{decision.glyph}</span>
        {decision.word}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-label text-foreground">{what}</span>
        <RuleProviderChips rule={rule} activeProviders={activeProviders} />
      </span>
      <span className="shrink-0 text-meta text-muted-foreground">{where}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Remove rule: ${what}`}
        onClick={() => setIsConfirming(true)}
      >
        Remove
      </Button>
    </div>
  );
};
