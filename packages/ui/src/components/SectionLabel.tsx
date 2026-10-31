import type { ReactNode } from 'react';
import { cn } from '../cn';
import { TEXT_ROLE } from '../textRoles';

const HEADING_TAG = { 2: 'h2', 3: 'h3' } as const;

export type SectionLabelProps = {
  readonly label: string;
  readonly count?: ReactNode;
  readonly headingLevel?: 2 | 3;
};

export const SectionLabel = ({ label, count, headingLevel }: SectionLabelProps) => {
  const Name = headingLevel === undefined ? 'span' : HEADING_TAG[headingLevel];
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Name data-section-label="" className={cn('min-w-0 truncate text-heading', TEXT_ROLE.label)}>
        {label}
      </Name>
      {count === undefined ? null : (
        <span className={cn('flex shrink-0 items-baseline text-ui tabular-nums', TEXT_ROLE.hint)}>
          {count}
        </span>
      )}
    </span>
  );
};
