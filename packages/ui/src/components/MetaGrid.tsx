import type { ReactNode } from 'react';
import { cn } from '../cn';

export type MetaItem = {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: string;
  readonly wide?: boolean;
};

export type MetaGridProps = {
  readonly items: ReadonlyArray<MetaItem>;
  readonly emptyLabel?: string;
  readonly className?: string;
};

const isEmpty = (value: ReactNode): boolean => value == null || value === '' || value === false;

export const MetaGrid = ({ items, emptyLabel = 'No attributes yet', className }: MetaGridProps) => {
  const present = items.filter((item) => !isEmpty(item.value));

  if (present.length === 0) {
    return <p className={cn('text-2xs text-muted-foreground/60', className)}>{emptyLabel}</p>;
  }

  return (
    <dl
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1.5 text-2xs',
        className,
      )}
    >
      {present.map((item) => (
        <div
          key={item.label}
          title={item.hint}
          className={cn(
            'flex min-w-0 flex-col gap-0.5 rounded-md border border-border-soft bg-subtle/50 px-2 py-1.5',
            item.wide === true && 'col-span-full',
          )}
        >
          <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
            {item.label}
          </dt>
          <dd className="min-w-0 truncate font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};
