export type Tone =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'primary'
  | 'accent'
  | 'merged'
  | 'neutral';

export type TintClasses = {
  readonly bg: string;
  readonly ring: string;
  readonly border: string;
  readonly text: string;
  readonly icon: string;
  readonly dot: string;
};

const TINT: Record<Tone, TintClasses> = {
  success: {
    bg: 'bg-success/10',
    ring: 'ring-success/20',
    border: 'border-success/40',
    text: 'text-success',
    icon: 'text-success',
    dot: 'bg-success',
  },
  info: {
    bg: 'bg-info/10',
    ring: 'ring-info/20',
    border: 'border-info/40',
    text: 'text-info',
    icon: 'text-info',
    dot: 'bg-info',
  },
  warning: {
    bg: 'bg-warning/10',
    ring: 'ring-warning/20',
    border: 'border-warning/40',
    text: 'text-warning',
    icon: 'text-warning',
    dot: 'bg-warning',
  },
  danger: {
    bg: 'bg-danger/10',
    ring: 'ring-danger/20',
    border: 'border-danger/40',
    text: 'text-danger',
    icon: 'text-danger',
    dot: 'bg-danger',
  },
  primary: {
    bg: 'bg-primary/10',
    ring: 'ring-primary/20',
    border: 'border-primary/40',
    text: 'text-primary',
    icon: 'text-primary',
    dot: 'bg-primary',
  },
  accent: {
    bg: 'bg-accent/10',
    ring: 'ring-accent/20',
    border: 'border-accent/40',
    text: 'text-accent',
    icon: 'text-accent',
    dot: 'bg-accent',
  },
  merged: {
    bg: 'bg-merged/10',
    ring: 'ring-merged/20',
    border: 'border-merged/40',
    text: 'text-merged',
    icon: 'text-merged',
    dot: 'bg-merged',
  },
  neutral: {
    bg: 'bg-muted',
    ring: 'ring-border-soft',
    border: 'border-border-soft',
    text: 'text-muted-foreground',
    icon: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

export const tintClasses = (tone: Tone): TintClasses => TINT[tone];
