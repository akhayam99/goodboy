import { Fragment } from 'react';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Stage = 0 | 1 | 2;

type Props = {
  readonly current: Stage;
  readonly canReach: (i: Stage) => boolean;
  readonly disabled: boolean;
  readonly onJump: (i: Stage) => void;
};

const STAGE_META: ReadonlyArray<{ readonly label: string; readonly icon: LucideIcon }> = [
  { label: 'Goal', icon: CONCEPT_ICONS.goal },
  { label: 'Approach', icon: CONCEPT_ICONS.workflows },
  { label: 'Steps', icon: CONCEPT_ICONS.checks },
];

export const StepperRail = ({ current, canReach, disabled, onJump }: Props) => (
  <nav
    aria-label="workflow builder steps"
    className="flex shrink-0 items-center justify-center gap-0.5 px-6 py-3"
  >
    {STAGE_META.map((meta, i) => {
      const step = i as Stage;
      const reachable = canReach(step);
      const active = current === step;
      const done = current > step;
      const Icon = meta.icon;
      return (
        <Fragment key={meta.label}>
          {i > 0 ? (
            <ChevronRight size={12} className="shrink-0 text-muted-foreground/30" aria-hidden />
          ) : null}
          <button
            type="button"
            onClick={() => onJump(step)}
            disabled={disabled || (!done && !reachable)}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              active && 'bg-primary/10 text-primary ring-1 ring-primary/20',
              done && !active && 'text-foreground hover:bg-muted/50',
              !active && !done && reachable && 'text-muted-foreground hover:bg-muted/40',
              !active && !done && !reachable && 'cursor-not-allowed text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-3xs font-semibold tabular-nums',
                active
                  ? 'bg-primary text-primary-foreground'
                  : done
                    ? 'bg-success/15 text-success'
                    : 'bg-muted/60 text-muted-foreground',
              )}
            >
              {done ? <Check size={10} aria-hidden /> : i + 1}
            </span>
            <span className="text-xs font-medium">{meta.label}</span>
          </button>
        </Fragment>
      );
    })}
  </nav>
);
