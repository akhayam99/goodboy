import type { ReactNode } from 'react';
import { cn } from '../cn';
import { SectionHeader } from './SectionHeader';

const SECTION_SURFACE_CLASS = 'flex flex-col gap-2 rounded-md bg-subtle p-3';

export type SectionSurfaceProps = {
  readonly label: string;
  readonly icon?: ReactNode;
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
  icon,
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
      icon={icon}
      size={headingSize}
      headingLevel={headingLevel}
      hint={hint}
      action={action}
    />
    {children}
  </section>
);
