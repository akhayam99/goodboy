import type { ReactNode } from 'react';

type Props = {
  readonly title: ReactNode;
  readonly meta: ReactNode;
  readonly tabs: ReactNode;
  readonly actions: ReactNode;
};

export const AgentHeader = ({ title, meta, tabs, actions }: Props) => (
  <div className="flex min-w-0 flex-col gap-1">
    <div
      data-testid="agent-header-title-row"
      className="flex min-h-8 min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1"
    >
      <h1 className="flex min-w-40 flex-1 text-title text-foreground">{title}</h1>
      <div className="flex shrink-0 items-center gap-4">
        {tabs}
        {actions}
      </div>
    </div>
    <div
      data-testid="agent-header-meta"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
    >
      {meta}
    </div>
  </div>
);
