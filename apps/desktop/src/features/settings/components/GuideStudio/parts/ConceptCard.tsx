import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

type Props = {
  readonly icon: ReactNode;
  readonly tone: Tone;
  readonly label: string;
  readonly body: string;
  readonly onClick?: () => void;
};

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
  muted: 'bg-muted',
};

const TONE_FG: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  muted: 'text-muted-foreground',
};

export const ConceptCard = ({ icon, tone, label, body, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col items-start gap-2 rounded-lg border border-border-soft bg-background p-4 text-left motion-safe:transition-all motion-safe:hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
  >
    <span
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md',
        TONE_BG[tone],
        TONE_FG[tone],
      )}
    >
      {icon}
    </span>
    <span className="text-sm font-semibold text-foreground">{label}</span>
    <span className="text-xs leading-relaxed text-muted-foreground">{body}</span>
  </button>
);
