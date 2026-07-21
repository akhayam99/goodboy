import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
  readonly onClick: () => void;
};

export const SummaryRow = ({ icon: Icon, tone, label, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-border"
  >
    <Icon size={14} aria-hidden className={cn('shrink-0', tintClasses(tone).icon)} />
    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
    <ArrowRight
      size={14}
      aria-hidden
      className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
    />
  </button>
);
