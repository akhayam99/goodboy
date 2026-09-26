import { cn } from '@goodboy/ui';
import { contextTokensForUsage } from '@goodboy/core';
import { Gauge } from 'lucide-react';
import type { ProviderName } from '@goodboy/types';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { formatTokens } from '../../agent-row-format';
import { contextUsageTone } from '../../contextUsageTone';
import { contextWindowFor } from '../../contextWindowFor';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { formatInteger } from '../../../../shared/utils/formatInteger';

export type ProviderContextUsage = {
  readonly provider: ProviderName;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
  readonly contextTokens?: number;
};

type ProviderBarProps = {
  readonly usage: ProviderContextUsage;
  readonly showProvider: boolean;
};

const ProviderBar = ({ usage, showProvider }: ProviderBarProps) => {
  const window = contextWindowFor(usage.model);
  const used = contextTokensForUsage(usage);
  if (used == null || window == null || window <= 0) {
    return null;
  }
  const pct = Math.min(1, used / window);
  const windowLabel = window >= 1_000_000 ? `${window / 1_000_000}M` : `${window / 1_000}k`;
  const tooltip =
    `${usage.provider} · ${modelLabel(usage.model)}\n` +
    `context: ${formatInteger(used)} / ${formatInteger(window)} tokens (${Math.round(pct * 100)}%)\n` +
    `last turn context: ${formatInteger(usage.inputTokens)} input · ${formatInteger(usage.cachedInputTokens ?? 0)} cache read · ${formatInteger(usage.cacheCreationInputTokens ?? 0)} cache write · ${formatInteger(usage.outputTokens)} output`;
  return (
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <div className="flex items-center justify-between text-meta uppercase tracking-eyebrow text-faint-foreground">
        <span
          className={cn('flex items-center gap-0.5', contextUsageTone({ pct, prefix: 'text' }))}
        >
          {showProvider ? (
            <ProviderIcon provider={usage.provider} variant="glyph" />
          ) : (
            <Gauge size={9} aria-hidden />
          )}
          ctx
        </span>
        <span className="font-mono">
          {formatTokens(used)} / {windowLabel} · {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            contextUsageTone({ pct, prefix: 'bg' }),
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
};

type Props = {
  readonly usage: ReadonlyArray<ProviderContextUsage>;
};

export const ContextWindowBar = ({ usage }: Props) => {
  const visibleUsage = usage.filter((entry) => {
    const window = contextWindowFor(entry.model);
    return contextTokensForUsage(entry) != null && window != null && window > 0;
  });
  if (visibleUsage.length === 0) {
    return null;
  }
  const showProvider = visibleUsage.length > 1;
  return (
    <div className="flex flex-col gap-1">
      {visibleUsage.map((u) => (
        <ProviderBar key={u.provider} usage={u} showProvider={showProvider} />
      ))}
    </div>
  );
};
