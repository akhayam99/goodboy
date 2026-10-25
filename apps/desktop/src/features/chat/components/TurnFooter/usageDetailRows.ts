import { formatTokens, formatUsd } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { formatInteger } from '../../../../shared/utils/formatInteger';
import { NAMES } from '../../../../shared/utils/names';
import type { UsageFigures } from '../../utils/usageFigures';
import type { TurnFooterData } from './useTurnFooter';

export type UsageDetailRow = {
  readonly label: string;
  readonly value: string | null;
  readonly missingReason: string | null;
  readonly isIndented: boolean;
};

type Params = {
  readonly data: TurnFooterData;
  readonly figures: UsageFigures;
  readonly duration: string | null;
  readonly startedAt: IsoDateTime | null;
  readonly endedAt: IsoDateTime | null;
  readonly outcome: string | null;
  readonly turns: number | null;
};

const NO_USAGE = 'no usage reported yet';

type PresentParams = {
  readonly label: string;
  readonly value: string;
  readonly isIndented?: boolean;
};

type MissingParams = {
  readonly label: string;
  readonly reason: string;
  readonly isIndented?: boolean;
};

const present = ({ label, value, isIndented = false }: PresentParams): UsageDetailRow => ({
  label,
  value,
  missingReason: null,
  isIndented,
});

const missing = ({ label, reason, isIndented = false }: MissingParams): UsageDetailRow => ({
  label,
  value: null,
  missingReason: reason,
  isIndented,
});

export const usageDetailRows = ({
  data,
  figures,
  duration,
  startedAt,
  endedAt,
  outcome,
  turns,
}: Params): ReadonlyArray<UsageDetailRow> => {
  const { totalInput, cachedPct, contextWindow, hasUsage } = figures;
  const rows: UsageDetailRow[] = [];
  if (outcome !== null) {
    rows.push(present({ label: 'Ended', value: outcome }));
  }
  if (turns !== null && turns > 0) {
    rows.push(present({ label: 'Turns', value: formatInteger(turns) }));
  }
  if (!hasUsage) {
    rows.push(missing({ label: 'Input', reason: NO_USAGE }));
    rows.push(missing({ label: 'Output', reason: NO_USAGE }));
  }
  if (hasUsage) {
    rows.push(present({ label: 'Input', value: formatInteger(totalInput) }));
    if (cachedPct !== null) {
      rows.push(
        present({
          label: 'from cache',
          value: `${formatInteger(data.cachedInputTokens)} · ${cachedPct}%`,
          isIndented: true,
        }),
      );
    }
    if (data.cacheCreationInputTokens > 0) {
      rows.push(
        present({
          label: 'cache write',
          value: formatInteger(data.cacheCreationInputTokens),
          isIndented: true,
        }),
      );
    }
    rows.push(present({ label: 'Output', value: formatInteger(data.outputTokens) }));
  }
  if (contextWindow !== null && contextWindow > 0) {
    rows.push(
      data.contextTokens === null
        ? missing({ label: NAMES.contextWindow, reason: 'context size not reported yet' })
        : present({
            label: NAMES.contextWindow,
            value: `${formatTokens(data.contextTokens)} of ${formatTokens(contextWindow)} · ${Math.round((data.contextTokens / contextWindow) * 100)}%`,
          }),
    );
  }
  if (duration !== null && startedAt !== null && endedAt !== null) {
    rows.push(
      present({
        label: 'Duration',
        value: `${duration} (${formatClock({ at: startedAt })} to ${formatClock({ at: endedAt })})`,
      }),
    );
  }
  rows.push(
    data.estimatedCostUsd === null
      ? missing({ label: 'Cost', reason: 'no cost estimate yet' })
      : present({ label: 'Cost', value: `~${formatUsd(data.estimatedCostUsd)}` }),
  );
  return rows;
};
