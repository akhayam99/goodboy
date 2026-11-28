import { Meter, TruncatedText, formatUsd } from '@goodboy/ui';
import type { Spender } from '../../reads/dailySpendOf';

type Props = {
  readonly spender: Spender;
  readonly topUsd: number;
};

export const SpenderRow = ({ spender, topUsd }: Props) => (
  <li className="flex min-w-0 flex-col gap-1">
    <span className="flex min-w-0 items-baseline justify-between gap-2">
      <TruncatedText className="text-meta text-foreground">{spender.goal}</TruncatedText>
      <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
        {formatUsd(spender.usd)}
      </span>
    </span>
    <Meter label={spender.goal} value={spender.usd} max={topUsd} size="xs" tone="neutral" />
  </li>
);
