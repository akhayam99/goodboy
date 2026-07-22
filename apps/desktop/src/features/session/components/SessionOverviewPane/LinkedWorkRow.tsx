import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

type Props = {
  readonly provider: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly identifier: string;
  readonly title: string;
  readonly state?: string;
  readonly onClick: () => void;
};

export const LinkedWorkRow = ({
  provider,
  icon: Icon,
  tone,
  identifier,
  title,
  state,
  onClick,
}: Props) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-border"
  >
    <span role="img" aria-label={provider} className={cn('shrink-0', tintClasses(tone).icon)}>
      <Icon size={14} aria-hidden />
    </span>
    <span className="shrink-0 font-mono text-xs font-semibold text-foreground">{identifier}</span>
    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{title}</span>
    {state != null ? (
      <span className="shrink-0 text-2xs text-muted-foreground">{state}</span>
    ) : null}
    <ArrowRight
      size={14}
      aria-hidden
      className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
    />
  </button>
);
