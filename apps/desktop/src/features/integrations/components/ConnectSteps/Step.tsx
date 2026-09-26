import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type StepStatus = 'done' | 'current' | 'later';

export type ConnectStepDef = {
  readonly id: string;
  readonly title: string;
  readonly help?: string;
  readonly status: StepStatus;
  readonly content?: ReactNode;
};

type Props = {
  readonly step: ConnectStepDef;
  readonly ordinal: number;
  readonly isLast: boolean;
};

const NODE_SIZE = 20;

export const ConnectStepsStep = ({ step, ordinal, isLast }: Props) => {
  const primaryTint = tintClasses('primary');
  const successTint = tintClasses('success');
  return (
    <li className="flex min-w-0 gap-3">
      <div className="flex shrink-0 flex-col items-center">
        <span
          aria-hidden
          className={cn(
            'flex items-center justify-center rounded-full border text-2xs font-semibold',
            step.status === 'done' && cn(successTint.solid, successTint.border),
            step.status === 'current' && cn(primaryTint.solid, primaryTint.border),
            step.status === 'later' && 'border-border-soft text-faint-foreground',
          )}
          style={{ width: NODE_SIZE, height: NODE_SIZE }}
        >
          {step.status === 'done' ? <Check size={ICON_SIZE.row} aria-hidden /> : ordinal}
        </span>
        {isLast ? null : (
          <span
            aria-hidden
            className={cn(
              'w-px flex-1',
              step.status === 'done' ? successTint.dot : 'bg-border-soft',
            )}
          />
        )}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col gap-1', !isLast && 'pb-4')}>
        <span
          className={cn(
            'text-[13px] font-semibold',
            step.status === 'later' ? 'text-faint-foreground' : 'text-foreground',
          )}
        >
          {step.title}
        </span>
        {step.help != null && (
          <span
            className={cn(
              'text-2xs leading-relaxed',
              step.status === 'later' ? 'text-faint-foreground' : 'text-muted-foreground',
            )}
          >
            {step.help}
          </span>
        )}
        {step.content != null && (
          <div
            aria-hidden={step.status === 'later'}
            className={cn(
              'mt-1 flex min-w-0 flex-col gap-2',
              step.status === 'later' && 'pointer-events-none opacity-50',
            )}
          >
            {step.content}
          </div>
        )}
      </div>
    </li>
  );
};
