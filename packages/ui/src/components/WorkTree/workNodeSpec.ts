import type { ReactNode } from 'react';

export type WorkNodeState =
  | 'queued'
  | 'ready'
  | 'running'
  | 'question'
  | 'budget'
  | 'failed'
  | 'done'
  | 'closed'
  | 'stopped'
  | 'skipped'
  | 'marker';

export type WorkNodeMark =
  | { readonly kind: 'index'; readonly value: string }
  | { readonly kind: 'dot' }
  | { readonly kind: 'glyph'; readonly glyph: ReactNode };

export const WORK_NODE_SIZE = 20;

export const WORK_NODE_GLYPH_SIZE = 12;

export const WORK_NODE_ARC = {
  radius: 9,
  strokeWidth: 2,
  headRadius: 1.75,
} as const satisfies Record<string, number>;

type RingSpec = {
  readonly radius: number;
  readonly strokeWidth: number;
  readonly strokeClassName: string;
  readonly fillClassName: string;
  readonly dashArray: string | null;
};

const QUEUED_DASH = '2.6 2.1';

export const WORK_NODE_RING: Record<Exclude<WorkNodeState, 'marker'>, RingSpec> = {
  queued: {
    radius: 9.25,
    strokeWidth: 1.5,
    strokeClassName: 'stroke-faint-foreground',
    fillClassName: 'fill-none',
    dashArray: QUEUED_DASH,
  },
  ready: {
    radius: 9.25,
    strokeWidth: 1.5,
    strokeClassName: 'stroke-warning',
    fillClassName: 'fill-none',
    dashArray: QUEUED_DASH,
  },
  running: {
    radius: 9,
    strokeWidth: 2,
    strokeClassName: 'stroke-border-soft',
    fillClassName: 'fill-none',
    dashArray: null,
  },
  question: {
    radius: 9.25,
    strokeWidth: 1.5,
    strokeClassName: 'stroke-warning',
    fillClassName: 'fill-none',
    dashArray: null,
  },
  budget: {
    radius: 9.25,
    strokeWidth: 1.5,
    strokeClassName: 'stroke-warning',
    fillClassName: 'fill-none',
    dashArray: null,
  },
  failed: {
    radius: 9.25,
    strokeWidth: 1.5,
    strokeClassName: 'stroke-danger',
    fillClassName: 'fill-none',
    dashArray: null,
  },
  done: {
    radius: 9.5,
    strokeWidth: 1,
    strokeClassName: 'stroke-success/70',
    fillClassName: 'fill-success/18',
    dashArray: null,
  },
  closed: {
    radius: 9.5,
    strokeWidth: 1,
    strokeClassName: 'stroke-border',
    fillClassName: 'fill-none',
    dashArray: null,
  },
  stopped: {
    radius: 9.5,
    strokeWidth: 1,
    strokeClassName: 'stroke-border',
    fillClassName: 'fill-none',
    dashArray: null,
  },
  skipped: {
    radius: 9.5,
    strokeWidth: 1,
    strokeClassName: 'stroke-border-soft',
    fillClassName: 'fill-none',
    dashArray: null,
  },
};
