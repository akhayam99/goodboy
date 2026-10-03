import type { ReactNode } from 'react';
import { BandRow, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly summary: string;
  readonly isSummaryNoted?: boolean;
  readonly anchor?: string;
  readonly children: ReactNode;
};

export const DefaultRow = ({ label, summary, isSummaryNoted = false, anchor, children }: Props) => (
  <BandRow isInteractive className="min-w-0 gap-3 py-0.5">
    <span data-default-row={anchor} className="w-36 shrink-0 truncate text-body text-foreground">
      {label}
    </span>
    <span
      className={cn(
        'min-w-0 flex-1 truncate text-label',
        isSummaryNoted ? 'text-muted-foreground' : 'text-faint-foreground',
      )}
      title={summary}
    >
      {summary}
    </span>
    <div className="w-[220px] min-w-0 shrink-0">{children}</div>
  </BandRow>
);
