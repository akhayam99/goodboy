export type Tone =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'primary'
  | 'accent'
  | 'merged'
  | 'operations'
  | 'neutral';

export type TintClasses = {
  readonly bg: string;
  readonly bgSoft: string;
  readonly ring: string;
  readonly border: string;
  readonly borderSoft: string;
  readonly hoverBorder: string;
  readonly hoverBg: string;
  readonly hoverBgSoft: string;
  readonly text: string;
  readonly icon: string;
  readonly dot: string;
  readonly solid: string;
};

const TINT: Record<Tone, TintClasses> = {
  success: {
    bg: 'bg-success/10',
    bgSoft: 'bg-success/5',
    ring: 'ring-success/20',
    border: 'border-success/40',
    borderSoft: 'border-success/20',
    hoverBorder: 'hover:border-success/40',
    hoverBg: 'hover:bg-success/20',
    hoverBgSoft: 'hover:bg-success/5',
    text: 'text-success',
    icon: 'text-success',
    dot: 'bg-success',
    solid: 'bg-success text-success-foreground',
  },
  info: {
    bg: 'bg-info/10',
    bgSoft: 'bg-info/5',
    ring: 'ring-info/20',
    border: 'border-info/40',
    borderSoft: 'border-info/20',
    hoverBorder: 'hover:border-info/40',
    hoverBg: 'hover:bg-info/20',
    hoverBgSoft: 'hover:bg-info/5',
    text: 'text-info',
    icon: 'text-info',
    dot: 'bg-info',
    solid: 'bg-info text-info-foreground',
  },
  warning: {
    bg: 'bg-warning/10',
    bgSoft: 'bg-warning/5',
    ring: 'ring-warning/20',
    border: 'border-warning/40',
    borderSoft: 'border-warning/20',
    hoverBorder: 'hover:border-warning/40',
    hoverBg: 'hover:bg-warning/20',
    hoverBgSoft: 'hover:bg-warning/5',
    text: 'text-warning',
    icon: 'text-warning',
    dot: 'bg-warning',
    solid: 'bg-warning text-warning-foreground',
  },
  danger: {
    bg: 'bg-danger/10',
    bgSoft: 'bg-danger/5',
    ring: 'ring-danger/20',
    border: 'border-danger/40',
    borderSoft: 'border-danger/20',
    hoverBorder: 'hover:border-danger/40',
    hoverBg: 'hover:bg-danger/20',
    hoverBgSoft: 'hover:bg-danger/5',
    text: 'text-danger',
    icon: 'text-danger',
    dot: 'bg-danger',
    solid: 'bg-danger text-danger-foreground',
  },
  primary: {
    bg: 'bg-primary/10',
    bgSoft: 'bg-primary/5',
    ring: 'ring-primary/20',
    border: 'border-primary/40',
    borderSoft: 'border-primary/20',
    hoverBorder: 'hover:border-primary/40',
    hoverBg: 'hover:bg-primary/20',
    hoverBgSoft: 'hover:bg-primary/5',
    text: 'text-primary',
    icon: 'text-primary',
    dot: 'bg-primary',
    solid: 'bg-primary text-primary-foreground',
  },
  accent: {
    bg: 'bg-accent/10',
    bgSoft: 'bg-accent/5',
    ring: 'ring-accent/20',
    border: 'border-accent/40',
    borderSoft: 'border-accent/20',
    hoverBorder: 'hover:border-accent/40',
    hoverBg: 'hover:bg-accent/20',
    hoverBgSoft: 'hover:bg-accent/5',
    text: 'text-accent',
    icon: 'text-accent',
    dot: 'bg-accent',
    solid: 'bg-accent text-accent-foreground',
  },
  merged: {
    bg: 'bg-merged/10',
    bgSoft: 'bg-merged/5',
    ring: 'ring-merged/20',
    border: 'border-merged/40',
    borderSoft: 'border-merged/20',
    hoverBorder: 'hover:border-merged/40',
    hoverBg: 'hover:bg-merged/20',
    hoverBgSoft: 'hover:bg-merged/5',
    text: 'text-merged',
    icon: 'text-merged',
    dot: 'bg-merged',
    solid: 'bg-merged text-merged-foreground',
  },
  operations: {
    bg: 'bg-muted/30',
    bgSoft: 'bg-muted/30',
    ring: 'ring-primary/20',
    border: 'border-primary/20',
    borderSoft: 'border-primary/20',
    hoverBorder: 'hover:border-primary/40',
    hoverBg: 'hover:bg-muted/50',
    hoverBgSoft: 'hover:bg-muted/30',
    text: 'text-foreground/80',
    icon: 'text-primary/60',
    dot: 'bg-primary/60',
    solid: 'bg-muted text-foreground',
  },
  neutral: {
    bg: 'bg-muted',
    bgSoft: 'bg-muted',
    ring: 'ring-border-soft',
    border: 'border-border-soft',
    borderSoft: 'border-border-soft',
    hoverBorder: 'hover:border-border-soft',
    hoverBg: 'hover:bg-muted',
    hoverBgSoft: 'hover:bg-muted/50',
    text: 'text-muted-foreground',
    icon: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
    solid: 'bg-muted text-foreground',
  },
};

export const tintClasses = (tone: Tone): TintClasses => TINT[tone];
