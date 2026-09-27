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
  <section
    aria-label={title}
    className={cn(
      'group/context-block flex flex-col gap-2 rounded-lg bg-fill px-3 py-2.5',
      className,
    )}
  >
    <div className="flex min-h-6 items-center justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-2">
        <Eyebrow
          label={title}
          icon={Icon != null ? <Icon size={ICON_SIZE.row} aria-hidden /> : undefined}
        />
        {count === undefined ? null : (
          <span className="text-secondary tabular-nums text-faint-foreground">{count}</span>
        )}
      </h3>
      {action ?? null}
    </div>
    {children}
  </section>
);
