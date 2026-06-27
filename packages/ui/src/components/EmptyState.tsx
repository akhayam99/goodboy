import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses } from '../tint';
import type { Tone } from '../tint';

export type EmptyStateProps = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly bordered?: boolean;
  readonly tone?: Tone;
  readonly className?: string;
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  bordered = false,
  tone,
  className,
}: EmptyStateProps) => {
  const tint = tone ? tintClasses(tone) : null;
  const iconBg = tint ? tint.bg : 'bg-muted';
  const iconColor = tint ? tint.icon : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-10 text-center',
        bordered && 'rounded-lg border border-dashed border-border-soft bg-elevated/40',
        className,
      )}
    >
      <span
        className={cn('flex size-12 items-center justify-center rounded-full', iconBg, iconColor)}
      >
        <Icon size={24} aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description ? (
          <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
};
