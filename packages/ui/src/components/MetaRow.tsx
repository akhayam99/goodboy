import { Fragment, type ReactNode } from 'react';
import { cn } from '../cn';

export type MetaRowProps = {
  readonly items: ReadonlyArray<ReactNode>;
  readonly className?: string;
};

export const MetaRow = ({ items, className }: MetaRowProps) => {
  const kept = items.filter((item) => item != null && item !== false);
  if (kept.length === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground',
        className,
      )}
    >
      {kept.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          ) : null}
          {item}
        </Fragment>
      ))}
    </span>
  );
};
