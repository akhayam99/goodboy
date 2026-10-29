import type { ReactNode } from 'react';
import { Button, ICON_SIZE, SelectableRow, Skeleton, cn } from '@goodboy/ui';
import { ChevronRight } from 'lucide-react';

export type SummaryCardState = 'loading' | 'error' | 'ready';

type Props = {
  readonly label: string;
  readonly state: SummaryCardState;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly onOpen: () => void;
  readonly onRetry: () => void;
};

const FRAME = 'flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-3 text-left';

export const SummaryCard = ({ label, state, children, footer, onOpen, onRetry }: Props) => {
  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-label={`Reading ${label}`}
        data-summary-card={label}
        className={FRAME}
      >
        <span className="text-meta text-muted-foreground">{label}</span>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div data-summary-card={label} className={FRAME}>
        <span className="text-meta text-muted-foreground">{label}</span>
        <span className="text-meta text-foreground">Couldn&apos;t read this</span>
        <div>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }
  const open = (
    <SelectableRow
      selected={false}
      ariaLabel={`Open ${label}`}
      testId={`summary-card-${label}`}
      className={cn(footer === undefined ? FRAME : 'gap-2', 'flex-col')}
      onClick={onOpen}
    >
      <span className="flex items-center gap-1 text-meta text-muted-foreground">
        {label}
        <ChevronRight size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
      </span>
      {children}
    </SelectableRow>
  );
  if (footer === undefined) {
    return open;
  }
  return (
    <div data-summary-card={label} className={FRAME}>
      {open}
      {footer}
    </div>
  );
};
