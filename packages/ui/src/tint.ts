export type Tone =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'primary'
  | 'accent'
  | 'merged'
  | 'draft'
  | 'operations'
  | 'neutral';

export type TintClasses = {
  readonly bg: string;
  readonly bgSoft: string;
  readonly ring: string;
  readonly ringStrong: string;
  readonly border: string;
  readonly borderSoft: string;
  readonly hoverBorder: string;
  readonly hoverBg: string;
  readonly hoverBgSoft: string;
  readonly hoverText: string;
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
    ringStrong: 'ring-success/60',
    border: 'border-success/40',
    borderSoft: 'border-success/20',
    hoverBorder: 'hover:border-success/40',
    hoverBg: 'hover:bg-success/20',
    hoverBgSoft: 'hover:bg-success/5',
    hoverText: 'hover:text-success',
    text: 'text-success',
    icon: 'text-success',
    dot: 'bg-success',
    solid: 'bg-success text-success-foreground',
  },
  info: {
    bg: 'bg-info/10',
    bgSoft: 'bg-info/5',
    ring: 'ring-info/20',
    ringStrong: 'ring-info/60',
    border: 'border-info/40',
    borderSoft: 'border-info/20',
    hoverBorder: 'hover:border-info/40',
    hoverBg: 'hover:bg-info/20',
    hoverBgSoft: 'hover:bg-info/5',
    hoverText: 'hover:text-info',
    text: 'text-info',
    icon: 'text-info',
    dot: 'bg-info',
    solid: 'bg-info text-info-foreground',
  },
  warning: {
    bg: 'bg-warning/10',
    bgSoft: 'bg-warning/5',
    ring: 'ring-warning/20',
    ringStrong: 'ring-warning/60',
    border: 'border-warning/40',
    borderSoft: 'border-warning/20',
    hoverBorder: 'hover:border-warning/40',
    hoverBg: 'hover:bg-warning/20',
    hoverBgSoft: 'hover:bg-warning/5',
    hoverText: 'hover:text-warning',
    text: 'text-warning',
    icon: 'text-warning',
    dot: 'bg-warning',
    solid: 'bg-warning text-warning-foreground',
  },
  danger: {
    bg: 'bg-danger/10',
    bgSoft: 'bg-danger/5',
    ring: 'ring-danger/20',
    ringStrong: 'ring-danger/60',
    border: 'border-danger/40',
    borderSoft: 'border-danger/20',
    hoverBorder: 'hover:border-danger/40',
    hoverBg: 'hover:bg-danger/20',
    hoverBgSoft: 'hover:bg-danger/5',
    hoverText: 'hover:text-danger',
    text: 'text-danger',
    icon: 'text-danger',
    dot: 'bg-danger',
    solid: 'bg-danger text-danger-foreground',
  },
  primary: {
    bg: 'bg-primary/10',
    bgSoft: 'bg-primary/5',
    ring: 'ring-primary/20',
    ringStrong: 'ring-primary/60',
    border: 'border-primary/40',
    borderSoft: 'border-primary/20',
    hoverBorder: 'hover:border-primary/40',
    hoverBg: 'hover:bg-primary/20',
    hoverBgSoft: 'hover:bg-primary/5',
    hoverText: 'hover:text-primary',
    text: 'text-primary',
    icon: 'text-primary',
    dot: 'bg-primary',
    solid: 'bg-primary text-primary-foreground',
  },
  accent: {
    bg: 'bg-accent/10',
    bgSoft: 'bg-accent/5',
    ring: 'ring-accent/20',
    ringStrong: 'ring-accent/60',
    border: 'border-accent/40',
    borderSoft: 'border-accent/20',
    hoverBorder: 'hover:border-accent/40',
    hoverBg: 'hover:bg-accent/20',
    hoverBgSoft: 'hover:bg-accent/5',
    hoverText: 'hover:text-accent',
    text: 'text-accent',
    icon: 'text-accent',
    dot: 'bg-accent',
    solid: 'bg-accent text-accent-foreground',
  },
  merged: {
    bg: 'bg-merged/10',
    bgSoft: 'bg-merged/5',
    ring: 'ring-merged/20',
    ringStrong: 'ring-merged/60',
    border: 'border-merged/40',
    borderSoft: 'border-merged/20',
    hoverBorder: 'hover:border-merged/40',
    hoverBg: 'hover:bg-merged/20',
    hoverBgSoft: 'hover:bg-merged/5',
    hoverText: 'hover:text-merged',
    text: 'text-merged',
    icon: 'text-merged',
    dot: 'bg-merged',
    solid: 'bg-merged text-merged-foreground',
  },
  draft: {
    bg: 'bg-draft/10',
    bgSoft: 'bg-draft/5',
    ring: 'ring-draft/20',
    ringStrong: 'ring-draft/60',
    border: 'border-draft/40',
    borderSoft: 'border-draft/20',
    hoverBorder: 'hover:border-draft/40',
    hoverBg: 'hover:bg-draft/20',
    hoverBgSoft: 'hover:bg-draft/5',
    hoverText: 'hover:text-draft',
    text: 'text-draft',
    icon: 'text-draft',
    dot: 'bg-draft',
    solid: 'bg-draft text-draft-foreground',
  },
  operations: {
    bg: 'bg-muted/30',
    bgSoft: 'bg-muted/30',
    ring: 'ring-primary/20',
    ringStrong: 'ring-primary/60',
    border: 'border-primary/20',
    borderSoft: 'border-primary/20',
    hoverBorder: 'hover:border-primary/40',
    hoverBg: 'hover:bg-muted/50',
    hoverBgSoft: 'hover:bg-muted/30',
    hoverText: 'hover:text-foreground',
    text: 'text-foreground/80',
    icon: 'text-primary/60',
    dot: 'bg-primary/60',
    solid: 'bg-muted text-foreground',
  },
  neutral: {
    bg: 'bg-muted',
    bgSoft: 'bg-muted',
    ring: 'ring-border-soft',
    ringStrong: 'ring-border',
    border: 'border-border-soft',
    borderSoft: 'border-border-soft',
    hoverBorder: 'hover:border-border-soft',
    hoverBg: 'hover:bg-muted',
    hoverBgSoft: 'hover:bg-muted/50',
    hoverText: 'hover:text-foreground',
    text: 'text-muted-foreground',
    icon: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
    solid: 'bg-muted text-foreground',
  },
};

export const tintClasses = (tone: Tone): TintClasses => TINT[tone];
