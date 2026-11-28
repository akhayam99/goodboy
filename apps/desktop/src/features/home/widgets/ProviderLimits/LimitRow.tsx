import { Meter, TruncatedText } from '@goodboy/ui';
import { usageWindowFactsOf } from '../../../providers/limits/usageWindowFactsOf';
import type { LimitRow as Row } from './limitRowsOf';

type Props = {
  readonly row: Row;
  readonly providerLabel: string | null;
  readonly nowMs: number;
};

export const LimitRow = ({ row, providerLabel, nowMs }: Props) => {
  const facts = usageWindowFactsOf({ window: row.window, siblings: row.siblings, nowMs });
  const name = providerLabel === null ? facts.label : `${providerLabel} · ${facts.label}`;
  return (
    <li className="flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-1">
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <TruncatedText className="text-row text-foreground">{name}</TruncatedText>
        <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
          {facts.percentText ?? 'Within limits'}
        </span>
      </span>
      <Meter label={name} value={(facts.fraction ?? 0) * 100} tone={facts.tone} size="xs" />
      <TruncatedText className="text-meta text-faint-foreground tabular-nums">
        {facts.resetText}
      </TruncatedText>
    </li>
  );
};
