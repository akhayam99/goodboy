import { cn } from '@goodboy/ui';
import type { UsageDetailRow } from './usageDetailRows';

type Props = {
  readonly row: UsageDetailRow;
};

export const UsageDetailRowView = ({ row }: Props) => (
  <div className="contents">
    <dt
      className={cn(
        'min-w-0',
        row.isIndented ? 'pl-3 text-faint-foreground' : 'text-muted-foreground',
      )}
    >
      {row.label}
    </dt>
    <dd className="whitespace-nowrap text-right tabular-nums text-foreground">
      {row.value ?? (
        <>
          <span aria-hidden="true">-</span>
          <span className="sr-only">{row.missingReason}</span>
        </>
      )}
    </dd>
  </div>
);
