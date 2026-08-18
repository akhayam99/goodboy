import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn, tintClasses, Tooltip } from '@goodboy/ui';
import { TranscriptShell } from '../TranscriptShell';

type NudgeSeverity = 'info' | 'warning' | 'success';

type NudgeAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly testId?: string;
};

export type Props = {
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
};

export const NudgeCard = ({
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
}: Props) => {
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const tint = tintClasses(severity);
  useEffect(() => {
    if (!autoFocusPrimary) {
      return;
    }
    const activeIsInput =
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement &&
      /^(input|textarea)$/i.test(document.activeElement.tagName);
    if (activeIsInput) {
      return;
    }
    const handle = window.setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [autoFocusPrimary]);

  return (
    <TranscriptShell tone={severity} variant="boxed" emphasis className="relative text-xs">
      <section data-testid={testId} aria-label={ariaLabel} className="flex flex-col gap-2">
        {onDismiss ? (
          <Tooltip content="Dismiss">
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              data-testid={testId ? `${testId}-dismiss` : undefined}
            >
              <X size={12} aria-hidden />
            </button>
          </Tooltip>
        ) : null}
        <div className="flex items-start gap-2 pr-5">
          {icon ? (
            <span className={cn('shrink-0 translate-y-0.5', tint.icon)} aria-hidden>
              {icon}
            </span>
          ) : null}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium leading-relaxed text-foreground">{title}</p>
              {body ? <p className="text-xs text-muted-foreground">{body}</p> : null}
            </div>
            {primary || secondary || tertiary ? (
              <div className="flex flex-wrap items-center gap-2">
                {primary ? (
                  <button
                    ref={primaryBtnRef}
                    type="button"
                    onClick={primary.onClick}
                    data-testid={primary.testId}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-2xs font-semibold hover:opacity-90',
                      tint.solid,
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
                    className="rounded-md border border-border px-2 py-0.5 text-2xs font-semibold text-foreground hover:bg-muted"
                  >
                    {secondary.label}
                  </button>
                ) : null}
                {tertiary ? (
                  <button
                    type="button"
                    onClick={tertiary.onClick}
                    data-testid={tertiary.testId}
                    className="rounded-md px-2 py-0.5 text-2xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {tertiary.label}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </TranscriptShell>
  );
};
