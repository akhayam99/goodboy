import type { ReactNode } from 'react';
import { cn } from '../cn';

export type DialogSectionHeaderTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export type DialogSectionHeaderProps = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly tone?: DialogSectionHeaderTone;
  readonly beta?: boolean;
  readonly className?: string;
};

const TILE_BG: Record<DialogSectionHeaderTone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
};

const TITLE_FG: Record<DialogSectionHeaderTone, string> = {
  primary: 'text-foreground',
  success: 'text-foreground',
  warning: 'text-foreground',
  danger: 'text-danger',
  info: 'text-foreground',
};

export const DialogSectionHeader = ({
  icon,
  title,
  description,
  tone = 'primary',
  beta,
  className,
}: DialogSectionHeaderProps) => {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', TILE_BG[tone])}>
          {icon}
        </span>
        <h3 className={cn('text-base font-semibold', TITLE_FG[tone])}>{title}</h3>
        {beta ? (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
            beta
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
};
