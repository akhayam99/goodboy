import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, cn, tintClasses, IconButton } from '@goodboy/ui';
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
    <TranscriptShell tone={severity} variant="boxed" emphasis className="relative text-meta">
      <section data-testid={testId} aria-label={ariaLabel} className="flex flex-col gap-2">
        {onDismiss ? (
          <IconButton
            icon={X}
            label="Dismiss"
            size="xs"
            onClick={onDismiss}
            data-testid={testId ? `${testId}-dismiss` : undefined}
            className="absolute right-1.5 top-1.5 size-5"
          />
        ) : null}
        <div className="flex items-start gap-2 pr-5">
          {icon ? (
            <span className={cn('shrink-0 translate-y-0.5', tint.icon)} aria-hidden>
              {icon}
            </span>
          ) : null}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <p className="text-body font-medium leading-relaxed text-foreground">{title}</p>
              {body ? <p className="text-meta text-muted-foreground">{body}</p> : null}
            </div>
            {primary || secondary || tertiary ? (
              <div className="flex flex-wrap items-center gap-2">
                {primary ? (
                  <Button
                    ref={primaryBtnRef}
                    size="xs"
                    onClick={primary.onClick}
                    data-testid={primary.testId}
                    className={tint.solid}
                  >
                    {primary.label}
                  </Button>
                ) : null}
                {secondary ? (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={secondary.onClick}
                    data-testid={secondary.testId}
                  >
                    {secondary.label}
                  </Button>
                ) : null}
                {tertiary ? (
                  <Button
                    variant="quiet"
                    size="xs"
                    onClick={tertiary.onClick}
                    data-testid={tertiary.testId}
                  >
                    {tertiary.label}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </TranscriptShell>
  );
};
