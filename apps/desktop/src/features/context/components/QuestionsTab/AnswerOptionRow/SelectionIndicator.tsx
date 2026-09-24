import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { OpenQuestionSelectMode } from '@goodboy/types';

type Props = {
  readonly mode: OpenQuestionSelectMode;
  readonly selected: boolean;
};

export const SelectionIndicator = ({ mode, selected }: Props) => (
  <span
    aria-hidden
    className={cn(
      'grid size-4 shrink-0 translate-y-0.5 place-items-center border',
      mode === 'many' ? 'rounded-sm' : 'rounded-full',
      selected ? 'border-primary bg-primary text-on-tone' : 'border-border bg-transparent',
    )}
  >
    {selected &&
      (mode === 'many' ? (
        <Check size={10} strokeWidth={3} aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      ))}
  </span>
);
