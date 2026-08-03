import type { ReactNode } from 'react';
import { Divider } from '@goodboy/ui';

type Props = {
  readonly lens: string;
  readonly count?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
};

export const FocusedPane = ({ lens, count, actions, children }: Props) => (
  <div className="flex h-full min-h-0 flex-col bg-background">
    <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-3">
      <div className="flex items-baseline gap-2">
        <h1 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          {lens}
        </h1>
        {count != null ? (
          <span className="text-2xs tabular-nums text-muted-foreground/70">{count}</span>
        ) : null}
      </div>
      {actions}
    </div>
    <Divider />
    <div className="flex min-h-0 flex-1">{children}</div>
  </div>
);
