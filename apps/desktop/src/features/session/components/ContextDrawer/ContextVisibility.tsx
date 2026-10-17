import { Check, Minus } from 'lucide-react';
import { ICON_SIZE, cn, Tooltip } from '@goodboy/ui';
import type { Visibility } from './roleVisibility';

type Props = {
  readonly visibility: Visibility;
};

const CHIP =
  'inline-flex items-center gap-1 rounded-sm border border-border-soft px-2 py-0.5 text-chip';

export const ContextVisibility = ({ visibility }: Props) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      {visibility.hasYou ? (
        <span className={cn(CHIP, 'bg-subtle text-foreground')}>
          <Check size={ICON_SIZE.mark} aria-hidden className="text-success" />
          You
        </span>
      ) : null}
      {visibility.chips.map((chip) => (
        <Tooltip key={chip.key} content={chip.isReading ? undefined : 'Does not receive this'}>
          <span
            className={cn(
              CHIP,
              chip.isReading ? 'bg-subtle text-foreground' : 'text-faint-foreground',
            )}
          >
            {chip.isReading ? (
              <Check size={ICON_SIZE.mark} aria-hidden className="text-success" />
            ) : (
              <Minus size={ICON_SIZE.mark} aria-hidden />
            )}
            {chip.label}
          </span>
        </Tooltip>
      ))}
    </div>
    <p className="text-meta text-faint-foreground">{visibility.note}</p>
  </div>
);
