import type { ReactNode } from 'react';
import type { Tone } from '../../tint';

export type WorkNodeState =
  | 'queued'
  | 'ready'
  | 'running'
  | 'question'
  | 'budget'
  | 'approval'
  | 'failed'
  | 'done'
  | 'closed'
  | 'stopped'
  | 'skipped'
  | 'marker'
  | 'mixed';

export type WorkNodeMark =
  | { readonly kind: 'index'; readonly value: string }
  | { readonly kind: 'dot' }
  | { readonly kind: 'glyph'; readonly glyph: ReactNode };

export type WorkNodeSize = 'md' | 'sm';

export const WORK_NODE_SIZE = 20;

export const WORK_NODE_SIZE_SM = 14;

export const WORK_NODE_GLYPH_SIZE = 12;

export const WORK_NODE_GLYPH_SIZE_SM = 9;

export const WORK_NODE_SIZE_FOR: Record<WorkNodeSize, number> = {
  md: WORK_NODE_SIZE,
  sm: WORK_NODE_SIZE_SM,
};

export const WORK_NODE_GLYPH_SIZE_FOR: Record<WorkNodeSize, number> = {
  md: WORK_NODE_GLYPH_SIZE,
  sm: WORK_NODE_GLYPH_SIZE_SM,
};

export const WORK_NODE_SCALE_FOR: Record<WorkNodeSize, number> = {
  md: 1,
  sm: WORK_NODE_SIZE_SM / WORK_NODE_SIZE,
};

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

export const WORK_NODE_RING: Record<Exclude<WorkNodeState, 'marker' | 'mixed'>, RingSpec> = {
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
  approval: {
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

export type WorkNodeMixedPart = {
  readonly tone: Tone;
  readonly count: number;
};

export const WORK_NODE_MIXED = {
  radius: 8.75,
  strokeWidth: 2,
  gap: 1.5,
} as const satisfies Record<string, number>;

export const WORK_NODE_MIXED_STROKE: Record<Tone, string> = {
  success: 'stroke-success',
  info: 'stroke-info',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  primary: 'stroke-primary',
  merged: 'stroke-merged',
  draft: 'stroke-faint-foreground',
  neutral: 'stroke-faint-foreground',
};

export type WorkNodeMixedArc = {
  readonly tone: Tone;
  readonly count: number;
  readonly length: number;
  readonly offset: number;
};

export const workNodeMixedArcs = ({
  parts,
  radius,
  gap,
}: {
  readonly parts: ReadonlyArray<WorkNodeMixedPart>;
  readonly radius: number;
  readonly gap: number;
}): ReadonlyArray<WorkNodeMixedArc> => {
  const counted = parts.filter((part) => part.count > 0);
  const total = counted.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) {
    return [];
  }
  const circumference = 2 * Math.PI * radius;
  const gaps = counted.length > 1 ? gap * counted.length : 0;
  const unit = (circumference - gaps) / total;
  const arcs: WorkNodeMixedArc[] = [];
  let position = gaps === 0 ? 0 : gap / 2;
  for (const part of counted) {
    const length = part.count * unit;
    arcs.push({ tone: part.tone, count: part.count, length, offset: position });
    position += length + (gaps === 0 ? 0 : gap);
  }
  return arcs;
};
