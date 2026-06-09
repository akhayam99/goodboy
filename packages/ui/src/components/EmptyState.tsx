import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';

export type EmptyStateProps = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly bordered?: boolean;
  readonly className?: string;
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  bordered = false,
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-10 text-center',
        bordered && 'rounded-lg border border-dashed border-border-soft bg-muted/10',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon size={18} aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description ? (
          <span className="max-w-xs text-2xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
};
