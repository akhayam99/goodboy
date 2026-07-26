import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Tone = 'warning' | 'danger' | 'accent';

type Props = {
  readonly label: string;
  readonly armedLabel: string;
  readonly busyLabel?: string;
  readonly onConfirm: () => void | Promise<void>;
  readonly disabled?: boolean;
  readonly tone?: Tone;
  readonly icon?: ReactNode;
  readonly autoDisarmMs?: number;
  readonly className?: string;
  readonly title?: string;
  readonly ariaLabel?: string;
};

const TONE_CLASS: Record<Tone, string> = {
  warning: 'border-warning/40 text-warning hover:bg-warning/10 data-[armed=true]:ring-warning/30',
  danger: 'border-danger/40 text-danger hover:bg-danger/10 data-[armed=true]:ring-danger/30',
  accent: 'border-primary/40 text-primary hover:bg-primary/10 data-[armed=true]:ring-primary/30',
};

export const ConfirmableButton = ({
  label,
  armedLabel,
  busyLabel,
  onConfirm,
  disabled = false,
  tone = 'warning',
  icon,
  autoDisarmMs,
  className,
  title,
  ariaLabel,
}: Props) => {
  const [isArmed, setIsArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isArmed || autoDisarmMs === undefined) {
      return;
    }
    const timer = window.setTimeout(() => setIsArmed(false), autoDisarmMs);
    return () => window.clearTimeout(timer);
  }, [autoDisarmMs, isArmed]);

  const confirm = async () => {
    setIsArmed(false);
    setIsBusy(true);
    try {
      await onConfirm();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || isBusy}
      data-armed={isArmed}
      title={title}
      aria-label={ariaLabel}
      onClick={() => {
        if (!isArmed) {
          setIsArmed(true);
          return;
        }
        void confirm();
      }}
      onBlur={() => setIsArmed(false)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors data-[armed=true]:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
        TONE_CLASS[tone],
        isBusy && 'animate-border-pulse',
        className,
      )}
    >
      {icon}
      {isBusy ? (busyLabel ?? armedLabel) : isArmed ? armedLabel : label}
    </button>
  );
};
