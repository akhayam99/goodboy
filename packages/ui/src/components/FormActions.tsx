import type { ReactNode } from 'react';
import { cn } from '../cn';

type Props = {
  readonly children: ReactNode;
  readonly leading?: ReactNode;
  readonly reason?: string | null;
  readonly reasonId?: string;
  readonly error?: ReactNode;
  readonly className?: string;
};

export const FormActions = ({
  children,
  leading = null,
  reason = null,
  reasonId,
  error = null,
  className,
}: Props) => (
  <div data-slot="form-actions" className={cn('flex flex-col gap-2', className)}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      {leading === null ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
    </div>
    {error === null ? null : (
      <div role="alert" className="self-end text-right text-meta text-danger">
        {error}
      </div>
    )}
    {reason === null ? null : (
      <p id={reasonId} className="self-end text-right text-meta text-faint-foreground">
        {reason}
      </p>
    )}
  </div>
);
