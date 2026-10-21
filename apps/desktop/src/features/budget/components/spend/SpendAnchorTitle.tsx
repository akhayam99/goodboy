import type { ReactNode } from 'react';

type Props = {
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly meta: string;
  readonly actions?: ReactNode;
};

export const SpendAnchorTitle = ({ glyph, title, meta, actions }: Props) => (
  <div className="flex min-w-0 items-center gap-3">
    {glyph ?? null}
    <div className="flex min-w-0 flex-1 flex-col">
      <h2 className="truncate text-heading text-foreground">{title}</h2>
      <span className="text-label text-muted-foreground">{meta}</span>
    </div>
    {actions ?? null}
  </div>
);
