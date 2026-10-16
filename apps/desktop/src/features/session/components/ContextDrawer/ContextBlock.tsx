import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eyebrow, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
};

export const ContextBlock = ({ title, icon: Icon, count, action, className, children }: Props) => (
  <section aria-label={title} className={cn('group/context-block flex flex-col gap-2', className)}>
    <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <h3 className="flex max-w-full shrink-0 items-center gap-2 whitespace-nowrap">
        <Eyebrow
          label={title}
          icon={Icon != null ? <Icon size={ICON_SIZE.row} aria-hidden /> : undefined}
        />
        {count === undefined ? null : (
          <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
        )}
      </h3>
      {action == null ? null : <span className="flex grow items-center justify-end">{action}</span>}
    </div>
    {children}
  </section>
);
