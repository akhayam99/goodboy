import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Eyebrow } from './Eyebrow';

const HEADING_TAG = { 2: 'h2', 3: 'h3' } as const;

export type SectionHeaderProps = {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly size?: 'eyebrow' | 'page';
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
  readonly htmlFor?: string;
};

export const SectionHeader = ({
  label,
  icon,
  hint,
  action,
  size = 'eyebrow',
  headingLevel,
  className,
  htmlFor,
}: SectionHeaderProps) => {
  const title = htmlFor != null ? <label htmlFor={htmlFor}>{label}</label> : label;

  if (size === 'page') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {icon != null ? <span className="flex shrink-0 items-center">{icon}</span> : null}
            <h2 className="min-w-0 text-base font-semibold leading-6 text-foreground">{title}</h2>
          </div>
          {action ?? null}
        </div>
        {hint != null ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  }

  const eyebrow = <Eyebrow icon={icon} label={title} className="flex items-center gap-1.5" />;
  const Heading = headingLevel == null ? null : HEADING_TAG[headingLevel];

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2">
        {Heading == null ? eyebrow : <Heading className="min-w-0">{eyebrow}</Heading>}
        {action ?? null}
      </div>
      {hint != null ? <p className="text-2xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
};
