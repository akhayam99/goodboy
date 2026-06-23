import { cn } from '@goodboy/ui';
import { Gauge } from 'lucide-react';
import type { ProviderId, ProviderName } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { formatTokens } from '../../../../../features/session/agent-row-format';
import { ProviderGlyph } from './ProviderGlyph';

export type ProviderContextUsage = {
  readonly provider: ProviderName;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

function findContextWindow(provider: ProviderName, model: string): number | null {
  const cap = PROVIDER_CAPABILITIES[provider as ProviderId];
  if (!cap) {
    return null;
  }
  const exact = cap.models.find((m) => m.id === model);
  if (exact) {
    return exact.contextWindow;
  }
  const fallback = cap.models.find((m) => m.tier === 'turn') ?? cap.models[0];
  return fallback?.contextWindow ?? null;
}

function tone(pct: number, prefix: 'bg' | 'text'): string {
  if (pct >= 0.9) {
    return `${prefix}-danger`;
  }
  if (pct >= 0.75) {
    return `${prefix}-warning`;
  }
  if (pct >= 0.5) {
    return `${prefix}-info`;
  }
  return `${prefix}-success`;
}

function ProviderBar({
  usage,
  showProvider,
}: {
  usage: ProviderContextUsage;
  showProvider: boolean;
}) {
  const window = findContextWindow(usage.provider, usage.model);
  if (!window) {
    return null;
  }
  const used = usage.inputTokens + usage.outputTokens;
  const pct = Math.min(1, used / window);
  const windowLabel = window >= 1_000_000 ? `${window / 1_000_000}M` : `${window / 1_000}k`;
  const tooltip =
    `${usage.provider} · ${usage.model}\n` +
    `context: ${used.toLocaleString()} / ${window.toLocaleString()} tokens (${Math.round(pct * 100)}%)\n` +
    `cumulative input: ${usage.inputTokens.toLocaleString()} · output: ${usage.outputTokens.toLocaleString()}`;
  return (
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground/60">
        <span className={cn('flex items-center gap-0.5', tone(pct, 'text'))}>
          {showProvider ? (
            <ProviderGlyph provider={usage.provider} />
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
          className={cn('h-full rounded-full transition-all', tone(pct, 'bg'))}
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
