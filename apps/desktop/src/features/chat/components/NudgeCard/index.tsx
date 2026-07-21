import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { MARKER_ACCENT, type MarkerAccent } from '../marker-accents';
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

const SEVERITY_PRIMARY: Record<NudgeSeverity, string> = {
  info: 'bg-info text-info-foreground',
  warning: 'bg-warning text-warning-foreground',
  success: 'bg-success text-success-foreground',
};

const SEVERITY_ACCENT: Readonly<Record<NudgeSeverity, MarkerAccent>> = {
  info: MARKER_ACCENT.info,
  warning: MARKER_ACCENT.warning,
  success: MARKER_ACCENT.success,
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
  const accent = SEVERITY_ACCENT[severity];
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
    <TranscriptShell tone={severity} variant="boxed" className="relative text-xs">
      <section data-testid={testId} aria-label={ariaLabel}>
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
            <span className={cn('mt-0.5 shrink-0', accent.icon)} aria-hidden>
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
                      'rounded px-2 py-0.5 text-2xs font-semibold hover:opacity-90',
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
                    className="rounded border border-border px-2 py-0.5 text-2xs font-semibold text-foreground hover:bg-muted"
                  >
                    {secondary.label}
                  </button>
                ) : null}
                {tertiary ? (
                  <button
                    type="button"
                    onClick={tertiary.onClick}
                    data-testid={tertiary.testId}
                    className="rounded px-2 py-0.5 text-2xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
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
