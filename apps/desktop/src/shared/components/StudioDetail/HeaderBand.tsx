import type { ReactNode } from 'react';

type Props = {
  readonly meta: ReactNode;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
};

export const HeaderBand = ({ meta, title, subtitle, actions }: Props) => {
  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">{meta}</div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">{title}</h2>
        {subtitle ?? null}
      </div>
      {actions != null ? (
        <div className="flex shrink-0 items-center gap-2 pt-0.5">{actions}</div>
      ) : null}
    </div>
  );
};
