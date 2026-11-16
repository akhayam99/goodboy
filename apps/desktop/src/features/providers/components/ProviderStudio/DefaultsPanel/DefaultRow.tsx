import type { ReactNode } from 'react';
import { BandRow, cn, TruncatedText } from '@goodboy/ui';
import { ROLE_GRID } from './roleGrid';

type Props = {
  readonly label: string;
  readonly summary: string;
  readonly isSummaryNoted?: boolean;
  readonly anchor?: string;
  readonly status?: ReactNode;
  readonly children: ReactNode;
};

export const DefaultRow = ({
  label,
  summary,
  isSummaryNoted = false,
  anchor,
  status,
  children,
}: Props) => (
  <BandRow isInteractive className="min-w-0">
    <div data-role-grid="" className={ROLE_GRID.row}>
      <span data-default-row={anchor} className={ROLE_GRID.name}>
        {label}
      </span>
      <TruncatedText
        className={cn(
          ROLE_GRID.job,
          isSummaryNoted ? 'text-muted-foreground' : 'text-faint-foreground',
        )}
      >
        {summary}
      </TruncatedText>
      <div className={ROLE_GRID.route}>{children}</div>
      <span className={ROLE_GRID.source}>{status}</span>
    </div>
    <span aria-hidden className="invisible text-row">
      ›
    </span>
  </BandRow>
);
