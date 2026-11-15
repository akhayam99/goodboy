import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn, Eyebrow, ICON_SIZE } from '@goodboy/ui';

const COUNT_FLOOR = 2;

type Props = {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
};

export const ContextBlock = ({ title, icon: Icon, count, action, className, children }: Props) => (
  <section aria-label={title} className={cn('group/context-block flex flex-col gap-1', className)}>
    <div className="flex h-7 min-w-0 items-center justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <Eyebrow
          label={title}
          icon={Icon != null ? <Icon size={ICON_SIZE.row} aria-hidden /> : undefined}
        />
        {count === undefined || count < COUNT_FLOOR ? null : (
          <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
        )}
      </h3>
      {action == null ? null : <span className="flex shrink-0 items-center gap-1">{action}</span>}
    </div>
    {children}
  </section>
);
