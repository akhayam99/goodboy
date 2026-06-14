import { cn } from '@goodboy/ui';
import { Gauge } from 'lucide-react';
import type { TelemetryRecord } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { formatTokens } from '../../../../../features/session/agent-row-format';
import type { AgentAggregate } from '../../../../../features/session/components/AgentMetricsBlock';

function findContextWindow(model: string): number | null {
  for (const cap of Object.values(PROVIDER_CAPABILITIES)) {
    const m = cap.models.find((mm) => mm.id === model);
    if (m) {
      return m.contextWindow;
    }
  }
  return null;
}

export function ContextWindowBar({
  telemetry,
  aggregate,
}: {
  telemetry: TelemetryRecord | null;
  aggregate: AgentAggregate | null;
}) {
  if (!telemetry) {
    return null;
  }
  const window = findContextWindow(telemetry.model);
  if (!window) {
    return null;
  }
  const cumulativeInput = aggregate?.inputTokens ?? telemetry.inputTokens;
  const cumulativeOutput = aggregate?.outputTokens ?? telemetry.outputTokens;
  const used = cumulativeInput + cumulativeOutput;
  const pct = Math.min(1, used / window);
  const barTone = (() => {
    if (pct >= 0.9) {
      return 'bg-danger';
    }
    if (pct >= 0.75) {
      return 'bg-warning';
    }
    if (pct >= 0.5) {
      return 'bg-info';
    }
    return 'bg-success';
  })();
  const iconTone = (() => {
    if (pct >= 0.9) {
      return 'text-danger';
    }
    if (pct >= 0.75) {
      return 'text-warning';
    }
    if (pct >= 0.5) {
      return 'text-info';
    }
    return 'text-success';
  })();
  const windowLabel = window >= 1_000_000 ? `${window / 1_000_000}M` : `${window / 1_000}k`;
  const tooltip =
    `context: ${used.toLocaleString()} / ${window.toLocaleString()} tokens (${Math.round(pct * 100)}%)\n` +
    `cumulative input: ${cumulativeInput.toLocaleString()} · output: ${cumulativeOutput.toLocaleString()}`;
  return (
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground/60">
        <span className={cn('flex items-center gap-0.5', iconTone)}>
          <Gauge size={9} aria-hidden />
          ctx
        </span>
        <span className="font-mono">
          {formatTokens(used)} / {windowLabel} · {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn('h-full rounded-full transition-all', barTone)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
