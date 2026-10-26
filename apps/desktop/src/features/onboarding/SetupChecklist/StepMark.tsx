import { Check } from 'lucide-react';
import { cn, ICON_SIZE, ICON_STROKE } from '@goodboy/ui';

type Props = {
  readonly isDone: boolean;
};

export const StepMark = ({ isDone }: Props) => (
  <span
    aria-hidden
    className={cn(
      'inline-flex size-4 shrink-0 items-center justify-center rounded-full',
      isDone ? 'bg-success text-on-tone' : 'ring-1 ring-inset ring-border',
    )}
  >
    {isDone ? <Check size={ICON_SIZE.mark} strokeWidth={ICON_STROKE.check} aria-hidden /> : null}
  </span>
);
