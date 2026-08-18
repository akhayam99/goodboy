import type { ReactNode } from 'react';
import { cn } from '../cn';
import { SectionHeader } from './SectionHeader';

export const SECTION_SURFACE_CLASS = 'flex flex-col gap-2 rounded-md bg-muted/30 p-3';

export type SectionSurfaceProps = {
  readonly label: string;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly headingSize?: 'eyebrow' | 'page';
  readonly headingLevel?: 2 | 3;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export const SectionSurface = ({
  label,
  hint,
  action,
  headingSize = 'eyebrow',
  headingLevel,
  ariaLabel,
  className,
  children,
}: SectionSurfaceProps) => (
  <section aria-label={ariaLabel} className={cn(SECTION_SURFACE_CLASS, className)}>
    <SectionHeader
      label={label}
      size={headingSize}
      headingLevel={headingLevel}
      hint={hint}
      action={action}
    />
    {children}
  </section>
);
