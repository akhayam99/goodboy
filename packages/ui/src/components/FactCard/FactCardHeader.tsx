import type { ReactNode } from 'react';

type Props = {
  readonly glyph?: ReactNode;
  readonly title: ReactNode;
  readonly sub?: string;
};

export const FactCardHeader = ({ glyph, title, sub }: Props) => (
  <div className="flex items-center gap-2">
    {glyph === undefined ? null : (
      <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
        {glyph}
      </span>
    )}
    {typeof title === 'string' ? (
      <span className="min-w-0 truncate text-heading text-foreground">{title}</span>
    ) : (
      title
    )}
    {sub === undefined ? null : (
      <span className="min-w-0 shrink-[2] truncate text-meta text-muted-foreground">{sub}</span>
    )}
  </div>
);
