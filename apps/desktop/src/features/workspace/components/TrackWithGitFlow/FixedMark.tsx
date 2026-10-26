import { Check } from 'lucide-react';
import { cn, ICON_SIZE, ICON_STROKE } from '@goodboy/ui';

type Props = {
  readonly isGoing: boolean;
};

export const FixedMark = ({ isGoing }: Props) => (
  <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
    <span
      className={cn(
        'flex size-4 items-center justify-center rounded-sm opacity-50',
        isGoing ? 'bg-primary text-background' : 'border border-border',
      )}
    >
      {isGoing ? <Check size={ICON_SIZE.row} strokeWidth={ICON_STROKE.check} /> : null}
    </span>
  </span>
);
