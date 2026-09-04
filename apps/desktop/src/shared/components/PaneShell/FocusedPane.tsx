import type { ReactNode } from 'react';
import { Divider, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';

type Props = {
  readonly lens: string;
  readonly count?: ReactNode;
  readonly actions?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly children: ReactNode;
};

export const FocusedPane = ({ lens, count, actions, eyebrow, children }: Props) => (
  <div className="flex h-full min-h-0 flex-col bg-background">
    <div className={cn('flex shrink-0 items-center justify-between gap-3', PANE_RHYTHM.header)}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow}
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            {lens}
          </h1>
          {count != null ? (
            <span className="text-2xs tabular-nums text-muted-foreground/70">{count}</span>
          ) : null}
        </div>
      </div>
      {actions}
    </div>
    <Divider />
    <div className="flex min-h-0 flex-1">{children}</div>
  </div>
);
