export type Tone =
  'success' | 'info' | 'warning' | 'danger' | 'primary' | 'merged' | 'draft' | 'neutral';

export type TintClasses = {
  readonly bg: string;
  readonly bgSoft: string;
  readonly ring: string;
  readonly ringStrong: string;
  readonly border: string;
  readonly borderSoft: string;
  readonly hoverBorder: string;
  readonly hoverRing: string;
  readonly hoverBg: string;
  readonly hoverBgSoft: string;
  readonly hoverText: string;
  readonly text: string;
  readonly icon: string;
  readonly dot: string;
  readonly solid: string;
  readonly rail: string;
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
    hoverRing: 'hover:ring-success/60',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-success/5',
    hoverText: 'hover:text-success',
    text: 'text-success',
    icon: 'text-success',
    dot: 'bg-success',
    solid: 'bg-success text-on-tone',
    rail: 'border-l-success',
  },
  info: {
    bg: 'bg-info/10',
    bgSoft: 'bg-info/5',
    ring: 'ring-info/20',
    ringStrong: 'ring-info/60',
    border: 'border-info/40',
    borderSoft: 'border-info/20',
    hoverBorder: 'hover:border-info/40',
    hoverRing: 'hover:ring-info/60',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-info/5',
    hoverText: 'hover:text-info',
    text: 'text-info',
    icon: 'text-info',
    dot: 'bg-info',
    solid: 'bg-info text-on-tone',
    rail: 'border-l-info',
  },
  warning: {
    bg: 'bg-warning/10',
    bgSoft: 'bg-warning/5',
    ring: 'ring-warning/20',
    ringStrong: 'ring-warning/60',
    border: 'border-warning/40',
    borderSoft: 'border-warning/20',
    hoverBorder: 'hover:border-warning/40',
    hoverRing: 'hover:ring-warning/60',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-warning/5',
    hoverText: 'hover:text-warning',
    text: 'text-warning',
    icon: 'text-warning',
    dot: 'bg-warning',
    solid: 'bg-warning text-on-tone',
    rail: 'border-l-warning',
  },
  danger: {
    bg: 'bg-danger/10',
    bgSoft: 'bg-danger/5',
    ring: 'ring-danger/20',
    ringStrong: 'ring-danger/60',
    border: 'border-danger/40',
    borderSoft: 'border-danger/20',
    hoverBorder: 'hover:border-danger/40',
    hoverRing: 'hover:ring-danger/60',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-danger/5',
    hoverText: 'hover:text-danger',
    text: 'text-danger',
    icon: 'text-danger',
    dot: 'bg-danger',
    solid: 'bg-danger text-on-tone',
    rail: 'border-l-danger',
  },
  primary: {
    bg: 'bg-primary/10',
    bgSoft: 'bg-primary/5',
    ring: 'ring-primary/20',
    ringStrong: 'ring-primary/60',
    border: 'border-primary/40',
    borderSoft: 'border-primary/20',
    hoverBorder: 'hover:border-primary/40',
    hoverRing: 'hover:ring-primary/60',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-primary/5',
    hoverText: 'hover:text-primary',
    text: 'text-primary',
    icon: 'text-primary',
    dot: 'bg-primary',
    solid: 'bg-primary text-on-tone',
    rail: 'border-l-primary',
  },
  merged: {
    bg: 'bg-merged/10',
    bgSoft: 'bg-merged/5',
    ring: 'ring-merged/20',
    ringStrong: 'ring-merged/60',
    border: 'border-merged/40',
    borderSoft: 'border-merged/20',
    hoverBorder: 'hover:border-merged/40',
    hoverRing: 'hover:ring-merged/60',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-merged/5',
    hoverText: 'hover:text-merged',
    text: 'text-merged',
    icon: 'text-merged',
    dot: 'bg-merged',
    solid: 'bg-merged text-on-tone',
    rail: 'border-l-merged',
  },
  draft: {
    bg: 'bg-draft/10',
    bgSoft: 'bg-draft/5',
    ring: 'ring-draft/20',
    ringStrong: 'ring-draft/60',
    border: 'border-draft/40',
    borderSoft: 'border-draft/20',
    hoverBorder: 'hover:border-draft/40',
    hoverRing: 'hover:ring-draft/60',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-draft/5',
    hoverText: 'hover:text-draft',
    text: 'text-draft',
    icon: 'text-draft',
    dot: 'bg-draft',
    solid: 'bg-draft text-on-tone',
    rail: 'border-l-draft',
  },
  neutral: {
    bg: 'bg-fill',
    bgSoft: 'bg-fill',
    ring: 'ring-border-soft',
    ringStrong: 'ring-border',
    border: 'border-border-soft',
    borderSoft: 'border-border-soft',
    hoverBorder: 'hover:border-border-soft',
    hoverRing: 'hover:ring-border',
    hoverBg: 'hover:bg-hover',
    hoverBgSoft: 'hover:bg-hover',
    hoverText: 'hover:text-foreground',
    text: 'text-muted-foreground',
    icon: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
    solid: 'bg-fill text-foreground',
    rail: 'border-l-border',
  },
};

export const tintClasses = (tone: Tone): TintClasses => TINT[tone];
