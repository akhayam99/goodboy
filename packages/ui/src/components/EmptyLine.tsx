import type { ComponentType, ReactNode } from 'react';
import { cn } from '../cn';

type IconProps = {
  readonly size?: number;
  readonly className?: string;
  readonly 'aria-hidden'?: boolean;
};

type Props = {
  readonly icon?: ComponentType<IconProps>;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
};

export const EmptyLine = ({ icon: Icon, action, className, children }: Props) => (
  <div
    data-slot="empty-line"
    className={cn(
      'flex min-h-7 min-w-0 items-center gap-2 text-label text-faint-foreground',
      className,
    )}
  >
    {Icon === undefined ? null : <Icon size={13} aria-hidden className="shrink-0" />}
    <p className="min-w-0 flex-1">{children}</p>
    {action ?? null}
  </div>
);
