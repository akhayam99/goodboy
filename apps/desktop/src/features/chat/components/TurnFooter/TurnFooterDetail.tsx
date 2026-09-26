import { formatTokens, formatUsd } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import { formatClockTime } from '../../../../shared/utils/formatClockTime';
import { formatInteger } from '../../../../shared/utils/formatInteger';
import { modelLabel } from '../../utils/chat-constants';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import type { TurnFooterData } from './useTurnFooter';

const providerLabelFor = (provider: TurnFooterData['provider']): string | null => {
  if (provider === null) {
    return null;
  }
  return provider in PROVIDER_LABEL
    ? PROVIDER_LABEL[provider as keyof typeof PROVIDER_LABEL]
    : provider;
};

const detailRow = ({
  label,
  value,
  indent = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly indent?: boolean;
}) => (
  <div key={label} className="flex items-baseline justify-between gap-3">
    <span className={indent ? 'pl-3 text-faint-foreground' : 'text-muted-foreground'}>{label}</span>
    <span className="font-mono tabular-nums text-foreground">{value}</span>
  </div>
);

type Props = {
  readonly data: TurnFooterData;
  readonly totalInput: number;
  readonly cachedPct: number | null;
  readonly contextWindow: number | null;
  readonly duration: string | null;
  readonly startedAt: IsoDateTime | null;
  readonly endedAt: IsoDateTime;
};

export const TurnFooterDetail = ({
  data,
  totalInput,
  cachedPct,
  contextWindow,
  duration,
  startedAt,
  endedAt,
}: Props) => {
  const providerLabel = providerLabelFor(data.provider);
  const heading = [
    data.model != null ? modelLabel(data.model) : 'Unknown model',
    data.effort,
    providerLabel,
  ]
    .filter((part) => part != null && part.length > 0)
    .join(' · ');

  return (
    <div className="flex w-70 flex-col gap-1.5 p-2 text-xs">
      <div className="text-sm font-medium text-foreground">{heading}</div>
      <div className="flex flex-col gap-0.5">
        {detailRow({ label: 'Input', value: formatInteger(totalInput) })}
        {cachedPct != null &&
          detailRow({
            label: 'from cache',
            value: `${formatInteger(data.cachedInputTokens)}   ${cachedPct}%`,
            indent: true,
          })}
        {data.cacheCreationInputTokens > 0 &&
          detailRow({
            label: 'cache write',
            value: formatInteger(data.cacheCreationInputTokens),
            indent: true,
          })}
        {detailRow({ label: 'Output', value: formatInteger(data.outputTokens) })}
        {data.contextTokens != null &&
          contextWindow != null &&
          contextWindow > 0 &&
          detailRow({
            label: 'Context',
            value: `${formatTokens(data.contextTokens)} of ${formatTokens(contextWindow)}   ${Math.round((data.contextTokens / contextWindow) * 100)}%`,
          })}
        {duration != null &&
          startedAt != null &&
          detailRow({
            label: 'Duration',
            value: `${duration}  (${formatClockTime({ iso: startedAt })} to ${formatClockTime({ iso: endedAt })})`,
          })}
        {data.estimatedCostUsd != null &&
          detailRow({
            label: 'Cost',
            value: `~${formatUsd(data.estimatedCostUsd)}  estimated at API prices`,
          })}
      </div>
    </div>
  );
};
