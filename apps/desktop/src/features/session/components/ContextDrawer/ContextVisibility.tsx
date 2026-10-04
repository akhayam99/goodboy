import { useState } from 'react';
import { Check, ChevronRight, Eye, Minus } from 'lucide-react';
import { ICON_SIZE, Reveal, cn } from '@goodboy/ui';
import type { Visibility } from './roleVisibility';

type Props = {
  readonly visibility: Visibility;
};

const CHIP =
  'inline-flex items-center gap-1 rounded-sm border border-border-soft px-2 py-0.5 text-chip';

export const ContextVisibility = ({ visibility }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="shrink-0 px-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 w-full items-center gap-1 rounded-md px-2 text-left text-meta text-faint-foreground hover:bg-hover"
      >
        <Eye size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span>Visible to</span>
        <span className="min-w-0 truncate text-muted-foreground">{visibility.summary}</span>
        <ChevronRight
          size={11}
          aria-hidden
          className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
      </button>
      <Reveal open={isOpen} className="px-2 pb-3 pt-2">
        <div className="flex flex-wrap gap-2">
          {visibility.hasYou ? (
            <span className={cn(CHIP, 'bg-subtle text-foreground')}>
              <Check size={11} aria-hidden className="text-success" />
              You
            </span>
          ) : null}
          {visibility.chips.map((chip) => (
            <span
              key={chip.key}
              title={chip.isReading ? undefined : 'Does not receive this'}
              className={cn(
                CHIP,
                chip.isReading ? 'bg-subtle text-foreground' : 'text-faint-foreground',
              )}
            >
              {chip.isReading ? (
                <Check size={11} aria-hidden className="text-success" />
              ) : (
                <Minus size={11} aria-hidden />
              )}
              {chip.label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-meta text-faint-foreground">{visibility.note}</p>
      </Reveal>
    </div>
  );
};
