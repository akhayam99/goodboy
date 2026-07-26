import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Eyebrow } from './Eyebrow';

export type SectionHeaderProps = {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly htmlFor?: string;
};

export const SectionHeader = ({
  label,
  icon,
  hint,
  action,
  className,
  htmlFor,
}: SectionHeaderProps) => {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow
          icon={icon}
          label={htmlFor != null ? <label htmlFor={htmlFor}>{label}</label> : label}
          className="flex items-center gap-1.5"
        />
        {action ?? null}
      </div>
      {hint ? <p className="text-2xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
};
