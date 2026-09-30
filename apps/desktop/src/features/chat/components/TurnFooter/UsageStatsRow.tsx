import { providerIdOf } from '../../../../shared/utils/providerIdOf';
import { Info } from 'lucide-react';
import { cn, formatTokens, formatUsd } from '@goodboy/ui';
import { modelLabel } from '../../utils/chat-constants';
import { contextUsageTone } from '../../../session/contextUsageTone';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import type { TurnFooterData } from './useTurnFooter';

type Props = {
  readonly data: TurnFooterData;
  readonly totalInput: number;
  readonly cachedPct: number | null;
  readonly contextPct: number | null;
  readonly duration?: string | null;
  readonly turns?: number | null;
};

export const UsageStatsRow = ({
  data,
  totalInput,
  cachedPct,
  contextPct,
  duration = null,
  turns = null,
}: Props) => (
  <>
    <ProviderIcon provider={data.provider} size={11} />
    {data.model != null && (
      <span>{modelLabel(data.model, providerIdOf({ value: data.provider }))}</span>
    )}
    {duration != null && <span className="text-faint-foreground">{duration}</span>}
    <span>
      {formatTokens(totalInput)} in · {formatTokens(data.outputTokens)} out
    </span>
    {cachedPct != null && <span>{cachedPct}% cached</span>}
    {data.estimatedCostUsd != null && <span>~{formatUsd(data.estimatedCostUsd)}</span>}
    {turns != null && (
      <span>
        {turns} turn{turns === 1 ? '' : 's'}
      </span>
    )}
    {contextPct != null && (
      <span className="flex items-center gap-1">
        <span className="h-0.5 w-6 overflow-hidden rounded-full bg-muted">
          <span
            className={cn(
              'block h-full rounded-full',
              contextUsageTone({ pct: contextPct, prefix: 'bg' }),
            )}
            style={{ width: `${contextPct * 100}%` }}
          />
        </span>
        <span className={contextUsageTone({ pct: contextPct, prefix: 'text' })}>
          {Math.round(contextPct * 100)}%
        </span>
      </span>
    )}
    <Info size={11} aria-hidden />
  </>
);
