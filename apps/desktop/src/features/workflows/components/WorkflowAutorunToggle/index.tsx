import { Zap, ZapOff } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { CardAction } from '@goodboy/ui';

type Props = {
  readonly isOn: boolean;
  readonly variant?: 'sidebar' | 'detail';
  readonly onToggle: () => void;
};

export const WorkflowAutorunToggle = ({ isOn, variant = 'detail', onToggle }: Props) => {
  const label = isOn ? 'Autorun on' : 'Autorun off';

  return (
    <div className="flex shrink-0 items-center">
      {variant === 'sidebar' ? (
        <CardAction
          icon={isOn ? Zap : ZapOff}
          label={label}
          tone="primary"
          pressed={isOn}
          highlighted={isOn}
          onClick={onToggle}
        />
      ) : (
        <button
          type="button"
          aria-pressed={isOn}
          aria-label={label}
          data-testid="workflow-autorun-toggle"
          onClick={onToggle}
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
    </div>
  );
};
