export type Tone =
  | 'primary'
  | 'merged'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'operations'
  | 'neutral';

export type MarkerType = 'plan' | 'clusters' | 'handoff' | 'resolve' | 'wontfix' | 'error';

export type MarkerAccent = {
  readonly border: string;
  readonly borderSoft: string;
  readonly bg: string;
  readonly bgSoft: string;
  readonly text: string;
  readonly icon: string;
};

type AccentKey = Tone | MarkerType;

const primary: MarkerAccent = {
  border: 'border-primary/40',
  borderSoft: 'border-primary/20',
  bg: 'bg-primary/10',
  bgSoft: 'bg-primary/5',
  text: 'text-primary',
  icon: 'text-primary',
};

const merged: MarkerAccent = {
  border: 'border-merged/40',
  borderSoft: 'border-merged/20',
  bg: 'bg-merged/10',
  bgSoft: 'bg-merged/5',
  text: 'text-merged',
  icon: 'text-merged',
};

const info: MarkerAccent = {
  border: 'border-info/40',
  borderSoft: 'border-info/20',
  bg: 'bg-info/10',
  bgSoft: 'bg-info/5',
  text: 'text-info',
  icon: 'text-info',
};

const success: MarkerAccent = {
  border: 'border-success/40',
  borderSoft: 'border-success/20',
  bg: 'bg-success/10',
  bgSoft: 'bg-success/5',
  text: 'text-success',
  icon: 'text-success',
};

const warning: MarkerAccent = {
  border: 'border-warning/40',
  borderSoft: 'border-warning/20',
  bg: 'bg-warning/10',
  bgSoft: 'bg-warning/5',
  text: 'text-warning',
  icon: 'text-warning',
};

const danger: MarkerAccent = {
  border: 'border-danger/40',
  borderSoft: 'border-danger/20',
  bg: 'bg-danger/10',
  bgSoft: 'bg-danger/5',
  text: 'text-danger',
  icon: 'text-danger',
};

const operations: MarkerAccent = {
  border: 'border-primary/20',
  borderSoft: 'border-primary/20',
  bg: 'bg-muted/30',
  bgSoft: 'bg-muted/30',
  text: 'text-foreground/80',
  icon: 'text-primary/60',
};

const neutral: MarkerAccent = {
  border: 'border-border',
  borderSoft: 'border-border',
  bg: 'bg-muted',
  bgSoft: 'bg-muted',
  text: 'text-muted-foreground',
  icon: 'text-muted-foreground',
};

export const MARKER_ACCENT: Readonly<Record<AccentKey, MarkerAccent>> = {
  primary,
  merged,
  info,
  success,
  warning,
  danger,
  operations,
  neutral,
  plan: primary,
  clusters: merged,
  handoff: info,
  resolve: success,
  wontfix: warning,
  error: danger,
};
