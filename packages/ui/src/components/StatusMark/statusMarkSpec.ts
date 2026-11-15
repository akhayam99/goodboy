import {
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleSlash,
  CircleStop,
  CircleX,
  Hand,
  MessageCircleQuestionMark,
  Play,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Tone } from '../../tint';

export type StatusMarkState =
  | 'running'
  | 'merging'
  | 'queued'
  | 'question'
  | 'approval'
  | 'budget'
  | 'alert'
  | 'ready'
  | 'failed'
  | 'done'
  | 'merged'
  | 'approved'
  | 'closed'
  | 'stopped'
  | 'skipped';

export type StatusMarkSpec =
  | { readonly kind: 'state'; readonly state: StatusMarkState }
  | { readonly kind: 'dot'; readonly tone: Tone }
  | { readonly kind: 'count'; readonly tone: Tone; readonly text: string }
  | { readonly kind: 'empty' };

type StatusMarkDrawing =
  | { readonly kind: 'ring'; readonly family: 'ring'; readonly className: string }
  | {
      readonly kind: 'glyph';
      readonly family: 'ring' | 'ask' | 'settled';
      readonly icon: LucideIcon;
      readonly className: string;
    };

export const STATUS_MARK_DRAWING: Record<StatusMarkState, StatusMarkDrawing> = {
  running: { kind: 'ring', family: 'ring', className: 'spin-border-info' },
  merging: { kind: 'ring', family: 'ring', className: 'spin-border-primary' },
  queued: {
    kind: 'glyph',
    family: 'ring',
    icon: CircleDashed,
    className: 'text-faint-foreground',
  },
  question: {
    kind: 'glyph',
    family: 'ask',
    icon: MessageCircleQuestionMark,
    className: 'text-warning',
  },
  approval: { kind: 'glyph', family: 'ask', icon: Hand, className: 'text-warning' },
  budget: { kind: 'glyph', family: 'ask', icon: Wallet, className: 'text-warning' },
  alert: { kind: 'glyph', family: 'ask', icon: TriangleAlert, className: 'text-warning' },
  ready: { kind: 'glyph', family: 'ask', icon: Play, className: 'text-warning' },
  failed: { kind: 'glyph', family: 'settled', icon: CircleX, className: 'text-danger' },
  done: { kind: 'glyph', family: 'settled', icon: CircleCheck, className: 'text-success' },
  merged: { kind: 'glyph', family: 'settled', icon: CircleCheck, className: 'text-merged' },
  approved: { kind: 'glyph', family: 'settled', icon: CircleCheck, className: 'text-success' },
  closed: {
    kind: 'glyph',
    family: 'settled',
    icon: CircleSlash,
    className: 'text-faint-foreground',
  },
  stopped: {
    kind: 'glyph',
    family: 'settled',
    icon: CircleStop,
    className: 'text-muted-foreground',
  },
  skipped: {
    kind: 'glyph',
    family: 'settled',
    icon: CircleMinus,
    className: 'text-faint-foreground',
  },
};
