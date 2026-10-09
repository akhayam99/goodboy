import type { ReactNode } from 'react';

type Props = {
  readonly title: ReactNode;
  readonly meta: ReactNode;
  readonly tabs: ReactNode;
  readonly actions: ReactNode;
};

export const AgentHeader = ({ title, meta, tabs, actions }: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 flex-col gap-1">
      <div
        data-testid="agent-header-title-row"
        data-slot="pane-title-row"
        className="flex h-8 min-w-0 items-center justify-between gap-4"
      >
        <h1 className="flex min-w-0 flex-1 truncate text-title text-foreground">{title}</h1>
        {actions == null ? null : <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div
        data-testid="agent-header-meta"
        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
      >
        {meta}
      </div>
    </div>
    {tabs == null ? null : (
      <div data-testid="agent-header-tabs" className="flex min-w-0 items-center">
        {tabs}
      </div>
    )}
  </div>
);
