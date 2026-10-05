import type { ReactNode } from 'react';

type Props = {
  readonly glyph: ReactNode;
  readonly title: string;
  readonly sub: string | null;
};

export const RowCardHeader = ({ glyph, title, sub }: Props) => (
  <span className="flex items-center gap-2">
    {glyph}
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className="text-heading text-foreground">{title}</span>
      {sub === null ? null : <span className="text-meta text-muted-foreground">{sub}</span>}
    </span>
  </span>
);
