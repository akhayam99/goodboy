import type { ReactNode } from 'react';

type Props = {
  readonly title: string;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
};

export const PaneTitleRow = ({ title, meta, actions }: Props) => (
  <div data-slot="pane-title-block" className="flex min-w-0 flex-col gap-1">
    <div data-slot="pane-title-row" className="flex h-8 min-w-0 items-center justify-between gap-3">
      <h1 className="min-w-0 truncate text-title text-foreground">{title}</h1>
      {actions != null ? (
        <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>
      ) : null}
    </div>
    {meta != null && meta !== '' ? (
      <p
        data-slot="pane-meta"
        className="min-w-0 truncate text-meta tabular-nums text-muted-foreground"
      >
        {meta}
      </p>
    ) : null}
  </div>
);
