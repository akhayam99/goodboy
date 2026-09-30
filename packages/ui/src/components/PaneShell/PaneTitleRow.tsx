import type { ReactNode } from 'react';

type Props = {
  readonly title: string;
  readonly icon: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
};

export const PaneTitleRow = ({ title, icon, meta, actions }: Props) => (
  <div className="flex min-h-8 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <div className="flex min-w-0 items-baseline gap-2">
      {icon}
      <h1 className="min-w-0 truncate text-title text-foreground">{title}</h1>
      {meta != null && meta !== '' ? (
        <span className="shrink-0 text-secondary tabular-nums text-muted-foreground">{meta}</span>
      ) : null}
    </div>
    {actions != null ? (
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">{actions}</div>
    ) : null}
  </div>
);
