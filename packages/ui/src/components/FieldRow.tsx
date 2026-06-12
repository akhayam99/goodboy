import type { ReactNode } from 'react';
import { cn } from '../cn';

export type FieldRowProps = {
  readonly label: string;
  readonly help?: ReactNode;
  readonly children: ReactNode;
  readonly layout?: 'horizontal' | 'stacked';
  readonly className?: string;
};

export const FieldRow = ({
  label,
  help,
  children,
  layout = 'horizontal',
  className,
}: FieldRowProps) => {
  const labelBlock = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {help ? <p className="text-2xs leading-relaxed text-muted-foreground">{help}</p> : null}
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col gap-2 py-4 first:pt-0 last:pb-0', className)}>
        {labelBlock}
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      {labelBlock}
      <div className="shrink-0">{children}</div>
    </div>
  );
};
