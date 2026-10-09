import type { ReactNode } from 'react';

type Props = {
  readonly meta: ReactNode;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
};

export const HeaderBand = ({ meta, title, subtitle, actions }: Props) => {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <div data-slot="pane-title-row" className="flex h-8 min-w-0 items-center gap-4">
          <h1 className="min-w-0 flex-1 truncate text-title text-foreground">{title}</h1>
          {actions != null ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">{meta}</div>
      </div>
      {subtitle ?? null}
    </div>
  );
};
