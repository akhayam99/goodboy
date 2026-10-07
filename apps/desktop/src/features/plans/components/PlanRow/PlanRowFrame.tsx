import type { ReactNode } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

const planTint = tintClasses(CONCEPT_TONE.plans);

type Props = {
  readonly children: ReactNode;
  readonly trailing?: ReactNode;
  readonly below?: ReactNode;
  readonly testId?: string;
};

export const PlanRowFrame = ({ children, trailing, below = null, testId = 'plan-row' }: Props) => (
  <>
    <div
      data-testid={testId}
      data-span="column"
      className={cn(
        'flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md border py-1 pl-3 pr-2 text-label',
        planTint.bgSoft,
        planTint.borderSoft,
      )}
    >
      {children}
      {trailing === undefined ? null : (
        <span className="flex shrink-0 items-center">{trailing}</span>
      )}
    </div>
    {below}
  </>
);
