import { providerIdOf } from '../../../../shared/utils/providerIdOf';
import type { IsoDateTime } from '@goodboy/types';
import { modelLabel } from '../../utils/chat-constants';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import type { TurnFooterData } from './useTurnFooter';
import { UsageDetailRowView } from './UsageDetailRowView';
import { usageDetailRows } from './usageDetailRows';
import { usageFigures } from '../../utils/usageFigures';

const providerLabelFor = (provider: TurnFooterData['provider']): string | null => {
  if (provider === null) {
    return null;
  }
  return provider in PROVIDER_LABEL
    ? PROVIDER_LABEL[provider as keyof typeof PROVIDER_LABEL]
    : provider;
};

type Props = {
  readonly data: TurnFooterData;
  readonly duration: string | null;
  readonly startedAt: IsoDateTime | null;
  readonly endedAt: IsoDateTime | null;
  readonly outcome?: string | null;
  readonly turns?: number | null;
};

export const TurnFooterDetail = ({
  data,
  duration,
  startedAt,
  endedAt,
  outcome = null,
  turns = null,
}: Props) => {
  const providerLabel = providerLabelFor(data.provider);
  const heading = [
    data.model !== null
      ? modelLabel(data.model, providerIdOf({ value: data.provider }))
      : 'Unknown model',
    data.effort,
    providerLabel,
  ]
    .filter((part) => part !== null && part.length > 0)
    .join(' · ');
  const rows = usageDetailRows({
    data,
    figures: usageFigures({ data }),
    duration,
    startedAt,
    endedAt,
    outcome,
    turns,
  });

  return (
    <div className="flex min-w-60 flex-col gap-2 p-2 text-label">
      <div className="break-words text-row text-foreground">{heading}</div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5">
        {rows.map((row) => (
          <UsageDetailRowView key={row.label} row={row} />
        ))}
      </dl>
      {data.estimatedCostUsd !== null && (
        <p className="text-meta text-faint-foreground">Cost estimated at API prices</p>
      )}
    </div>
  );
};
