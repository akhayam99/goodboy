import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@goodboy/ui';

export type NudgeSeverity = 'info' | 'warning' | 'success';

export interface NudgeAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly testId?: string;
}

export interface Props {
  readonly severity: NudgeSeverity;
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly body?: ReactNode;
  readonly primary?: NudgeAction;
  readonly secondary?: NudgeAction;
  readonly tertiary?: NudgeAction;
  readonly onDismiss?: () => void;
  readonly ariaLabel: string;
  readonly testId?: string;
  readonly autoFocusPrimary?: boolean;
}

const SEVERITY_FRAME: Record<NudgeSeverity, string> = {
  info: 'border-info/40 bg-info/10',
  warning: 'border-warning/40 bg-warning/10',
  success: 'border-success/40 bg-success/10',
};

const SEVERITY_PRIMARY: Record<NudgeSeverity, string> = {
  info: 'bg-info text-info-foreground',
  warning: 'bg-warning text-warning-foreground',
  success: 'bg-success text-success-foreground',
};

const SEVERITY_ICON: Record<NudgeSeverity, string> = {
  info: 'text-info',
  warning: 'text-warning',
  success: 'text-success',
};

export function NudgeCard({
  severity,
  icon,
  title,
  body,
  primary,
  secondary,
  tertiary,
  onDismiss,
  ariaLabel,
  testId,
  autoFocusPrimary = false,
}: Props) {
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!autoFocusPrimary) return;
    const activeIsInput =
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement &&
      /^(input|textarea)$/i.test(document.activeElement.tagName);
    if (activeIsInput) return;
    const handle = window.setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [autoFocusPrimary]);

  return (
    <section
      className={cn('relative rounded border px-2.5 py-2 text-[11px]', SEVERITY_FRAME[severity])}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="dismiss"
          className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          data-testid={testId ? `${testId}-dismiss` : undefined}
        >
          <X size={12} aria-hidden />
        </button>
      ) : null}
      <div className="flex items-start gap-2 pr-5">
        {icon ? (
          <span className={cn('mt-0.5 shrink-0', SEVERITY_ICON[severity])} aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="flex-1">
          <p className="text-foreground">{title}</p>
          {body ? <p className="mt-0.5 text-muted-foreground">{body}</p> : null}
          {primary || secondary || tertiary ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {primary ? (
                <button
                  ref={primaryBtnRef}
                  type="button"
                  onClick={primary.onClick}
                  data-testid={primary.testId}
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] font-semibold hover:opacity-90',
                    SEVERITY_PRIMARY[severity],
                  )}
                >
                  {primary.label}
                </button>
              ) : null}
              {secondary ? (
                <button
                  type="button"
                  onClick={secondary.onClick}
                  data-testid={secondary.testId}
                  className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
                >
                  {secondary.label}
                </button>
              ) : null}
              {tertiary ? (
                <button
                  type="button"
                  onClick={tertiary.onClick}
                  data-testid={tertiary.testId}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {tertiary.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
