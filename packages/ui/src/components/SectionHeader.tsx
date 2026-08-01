import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Eyebrow } from './Eyebrow';

export type SectionHeaderProps = {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly size?: 'eyebrow' | 'page';
  readonly className?: string;
  readonly htmlFor?: string;
};

export const SectionHeader = ({
  label,
  icon,
  hint,
  action,
  size = 'eyebrow',
  className,
  htmlFor,
}: SectionHeaderProps) => {
  const title = htmlFor != null ? <label htmlFor={htmlFor}>{label}</label> : label;

  if (size === 'page') {
    return (
      <div className={cn('flex items-start gap-3', className)}>
        {icon != null ? <span className="flex w-5 shrink-0 justify-center">{icon}</span> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {action ?? null}
          </div>
          {hint != null ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow icon={icon} label={title} className="flex items-center gap-1.5" />
        {action ?? null}
      </div>
      {hint != null ? <p className="text-2xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
};
