import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../cn';
import { ICON_SIZE } from '../iconSize';

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
    <div
      className={cn(
        'flex flex-wrap items-center gap-3',
        leading === null ? 'justify-end' : 'justify-between',
      )}
    >
      {leading === null ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>
      )}
      <div className="flex max-w-full shrink-0 items-center gap-2">{children}</div>
    </div>
    {error === null ? null : (
      <div
        role="alert"
        data-slot="form-actions-error"
        className="flex items-start gap-2 self-end text-right text-meta text-foreground"
      >
        <span className="flex h-4 shrink-0 items-center">
          <CircleAlert
            size={ICON_SIZE.control}
            aria-hidden
            data-testid="form-actions-error-glyph"
            className="text-danger"
          />
        </span>
        <span className="min-w-0">{error}</span>
      </div>
    )}
    {reason === null ? null : (
      <p id={reasonId} className="self-end text-right text-meta text-faint-foreground">
        {reason}
      </p>
    )}
  </div>
);
