import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { SectionHeader } from '../SectionHeader';
import { BandDepthContext, useBandDepthGuard } from './bandDepth';

export { BandRow, BAND_ROW_CLASS } from './BandRow';
export { BandStack } from './BandStack';
export { STRIPED_BLOCK_ROW, STRIPED_MIN_ROWS, STRIPED_ROW } from './stripedRow';

const INSET_CLASS = {
  rows: 'p-1',
  content: 'gap-2 p-3',
} satisfies Record<string, string>;

export type BandProps = {
  readonly label?: string;
  readonly icon?: ReactNode;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly headingSize?: 'eyebrow' | 'page';
  readonly headingLevel?: 2 | 3;
  readonly groupLabel?: string;
  readonly groupMeta?: ReactNode;
  readonly inset?: keyof typeof INSET_CLASS;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export const Band = ({
  label,
  icon,
  hint,
  action,
  headingSize = 'eyebrow',
  headingLevel,
  groupLabel,
  groupMeta,
  inset = 'rows',
  ariaLabel,
  className,
  children,
}: BandProps) => {
  useBandDepthGuard();

  const band = (
    <div
      data-band=""
      className={cn(
        'flex flex-col rounded-lg bg-fill',
        INSET_CLASS[inset],
        label == null && className,
      )}
    >
      {groupLabel != null ? (
        <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1.5">
          <span className="text-label font-medium text-muted-foreground">{groupLabel}</span>
          {groupMeta != null ? (
            <span className="text-secondary text-faint-foreground">{groupMeta}</span>
          ) : null}
        </div>
      ) : null}
      <BandDepthContext.Provider value>{children}</BandDepthContext.Provider>
    </div>
  );

  if (label == null) {
    return ariaLabel == null ? band : <section aria-label={ariaLabel}>{band}</section>;
  }

  return (
    <section aria-label={ariaLabel} className={cn('flex flex-col gap-2', className)}>
      <SectionHeader
        label={label}
        icon={icon}
        size={headingSize}
        headingLevel={headingLevel}
        hint={hint}
        action={action}
      />
      {band}
    </section>
  );
};
