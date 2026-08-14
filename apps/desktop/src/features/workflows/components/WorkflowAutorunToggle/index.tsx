import { useState } from 'react';
import { CircleStop, Zap, ZapOff } from 'lucide-react';
import { InlineConfirm, cn } from '@goodboy/ui';
import { CardAction } from '@goodboy/ui';

type Props = {
  readonly isOn: boolean;
  readonly isStepInFlight: boolean;
  readonly variant?: 'sidebar' | 'detail';
  readonly onToggle: () => void;
  readonly onStopNow: () => void;
};

export const WorkflowAutorunToggle = ({
  isOn,
  isStepInFlight,
  variant = 'detail',
  onToggle,
  onStopNow,
}: Props) => {
  const [isArmed, setIsArmed] = useState(false);
  const label = isOn ? 'Autorun on' : 'Autorun off';

  const press = () => {
    if (isOn && isStepInFlight) {
      setIsArmed(true);
      return;
    }
    onToggle();
  };

  return (
    <div className="relative flex shrink-0 items-center">
      {variant === 'sidebar' ? (
        <CardAction
          icon={isOn ? Zap : ZapOff}
          label={label}
          tone="primary"
          pressed={isOn}
          highlighted={isOn}
          expanded={isArmed}
          onClick={press}
        />
      ) : (
        <button
          type="button"
          aria-pressed={isOn}
          aria-expanded={isArmed}
          aria-label={label}
          data-testid="workflow-autorun-toggle"
          onClick={press}
          className={cn(
            'inline-flex min-h-7 min-w-[6.5rem] shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 text-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors',
            isOn
              ? 'border-primary/40 bg-primary/10 text-primary hover:border-primary'
              : 'border-border-soft text-muted-foreground hover:border-border hover:text-foreground',
          )}
        >
          {isOn ? <Zap size={12} aria-hidden /> : <ZapOff size={12} aria-hidden />}
          {label}
        </button>
      )}
      {isArmed ? (
        <InlineConfirm
          role="alert"
          icon={<CircleStop size={12} aria-hidden />}
          title="Stop this run?"
          description="The run stops, the step in flight is skipped, and everything it already wrote is kept."
          confirmLabel="Stop the run"
          onConfirm={() => {
            setIsArmed(false);
            onStopNow();
          }}
          onCancel={() => setIsArmed(false)}
          className="absolute right-0 top-full z-40 mt-1 w-72 bg-background shadow-lg"
        />
      ) : null}
    </div>
  );
};
