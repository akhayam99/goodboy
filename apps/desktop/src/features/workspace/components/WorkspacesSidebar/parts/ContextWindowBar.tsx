import { cn } from '@goodboy/ui';
import { getModelDescriptor } from '@goodboy/core';
import { Gauge } from 'lucide-react';
import type { ProviderName } from '@goodboy/types';
import { formatTokens } from '../../../../../features/session/agent-row-format';
import { contextUsageTone } from '../../../../../features/session/contextUsageTone';
import { contextWindowFor } from '../../../../../features/session/contextWindowFor';
import { ProviderIcon } from '../../../../../features/providers/components/ProviderIcon';

export type ProviderContextUsage = {
  readonly provider: ProviderName;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

function ProviderBar({
  usage,
  showProvider,
}: {
  usage: ProviderContextUsage;
  showProvider: boolean;
}) {
  const window = contextWindowFor({ provider: usage.provider, model: usage.model });
  if (!window) {
    return null;
  }
  const used = usage.inputTokens + usage.outputTokens;
  const pct = Math.min(1, used / window);
  const windowLabel = window >= 1_000_000 ? `${window / 1_000_000}M` : `${window / 1_000}k`;
  const modelLabel = getModelDescriptor(usage.model)?.label ?? usage.model;
  const tooltip =
    `${usage.provider} · ${modelLabel}\n` +
    `context: ${used.toLocaleString()} / ${window.toLocaleString()} tokens (${Math.round(pct * 100)}%)\n` +
    `cumulative input: ${usage.inputTokens.toLocaleString()} · output: ${usage.outputTokens.toLocaleString()}`;
  return (
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground/60">
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
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted/60">
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
}

export function ContextWindowBar({ usage }: { usage: ReadonlyArray<ProviderContextUsage> }) {
  if (usage.length === 0) {
    return null;
  }
  const showProvider = usage.length > 1;
  return (
    <div className="flex flex-col gap-1">
      {usage.map((u) => (
        <ProviderBar key={u.provider} usage={u} showProvider={showProvider} />
      ))}
    </div>
  );
}
