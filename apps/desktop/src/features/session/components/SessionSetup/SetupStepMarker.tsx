import { Check } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SetupStepStatus } from './sessionSetupSteps';

type Props = {
  readonly ordinal: number;
  readonly status: SetupStepStatus;
};

export const SetupStepMarker = ({ ordinal, status }: Props) => (
  <span
    aria-hidden
    className={cn(
      'flex size-5 shrink-0 items-center justify-center rounded-full text-meta tabular-nums',
      status === 'current' && 'bg-primary text-on-tone',
      status === 'done' && cn(tintClasses('success').bg, tintClasses('success').text),
      (status === 'upcoming' || status === 'skipped') &&
        'text-faint-foreground ring-1 ring-inset ring-border-soft',
    )}
  >
    {status === 'done' ? <Check size={ICON_SIZE.row} /> : ordinal}
  </span>
);
