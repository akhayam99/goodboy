export type MarkerType =
  | 'plan'
  | 'clusters'
  | 'handoff'
  | 'resolve'
  | 'wontfix'
  | 'error'
  | 'operations'

export type MarkerAccent = {
  readonly border: string
  readonly bg: string
  readonly text: string
  readonly icon: string
}

export const MARKER_ACCENT: Readonly<Record<MarkerType, MarkerAccent>> = {
  plan: {
    border: 'border-primary/40',
    bg: 'bg-primary/10',
    text: 'text-primary',
    icon: 'text-primary',
  },
  clusters: {
    border: 'border-merged/40',
    bg: 'bg-merged/10',
    text: 'text-merged',
    icon: 'text-merged',
  },
  handoff: {
    border: 'border-info/40',
    bg: 'bg-info/10',
    text: 'text-info',
    icon: 'text-info',
  },
  resolve: {
    border: 'border-success/40',
    bg: 'bg-success/10',
    text: 'text-success',
    icon: 'text-success',
  },
  wontfix: {
    border: 'border-warning/40',
    bg: 'bg-warning/10',
    text: 'text-warning',
    icon: 'text-warning',
  },
  error: {
    border: 'border-danger/40',
    bg: 'bg-danger/10',
    text: 'text-danger',
    icon: 'text-danger',
  },
  operations: {
    border: 'border-primary/20',
    bg: 'bg-muted/30',
    text: 'text-foreground/80',
    icon: 'text-primary/60',
  },
}
