import type { ReactNode } from 'react';
import { Divider, Eyebrow, PageColumn } from '@goodboy/ui';
import { PageCrumbRow } from './PageCrumbRow';
import { PageCrumbContext } from './PageCrumbContext';

type Props = {
  readonly lens: string;
  readonly count?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
};

export const FocusedPane = ({ lens, count, actions, children }: Props) => (
  <div className="@container flex h-full min-h-0 flex-col bg-background">
    <PageColumn className="flex shrink-0 flex-col gap-1 pb-3 pt-3">
      <PageCrumbRow isFramed={false} />
      <div className="flex min-h-8 items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <Eyebrow label={lens} muted />
          {count != null ? (
            <span className="text-secondary tabular-nums text-faint-foreground">{count}</span>
          ) : null}
        </div>
        {actions}
      </div>
    </PageColumn>
    <Divider />
    <div className="flex min-h-0 flex-1">
      <PageCrumbContext.Provider value={null}>{children}</PageCrumbContext.Provider>
    </div>
  </div>
);
