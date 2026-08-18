import { Check, Clock, MessageCircleQuestionMark, Minus, TriangleAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { TimelineMarkerState } from '../../../../timeline/markerState';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';
import { TimelineEmphasisMarker } from './TimelineEmphasisMarker';
import { TIMELINE_SURFACE_FILL } from './timelineLayout';

type Props = {
  readonly state: TimelineMarkerState;
  readonly grade: TimelineRowGrade;
  readonly hasUnread?: boolean;
};

type CircleState = Exclude<TimelineMarkerState, 'needsUser' | 'question'>;

type Fill = 'hollow' | 'soft' | 'solid';

type CircleSpec = {
  readonly tone: Tone;
  readonly icon: LucideIcon | null;
  readonly fill: Fill;
  readonly label: string;
};

const CIRCLE: Record<CircleState, CircleSpec> = {
  done: { tone: 'success', icon: Check, fill: 'soft', label: 'Done' },
  failed: { tone: 'danger', icon: X, fill: 'solid', label: 'Failed' },
  skipped: { tone: 'neutral', icon: Minus, fill: 'soft', label: 'Skipped' },
  pending: { tone: 'neutral', icon: Clock, fill: 'hollow', label: 'Not started' },
  running: { tone: 'info', icon: null, fill: 'hollow', label: 'Running' },
};

const SHAPE: Record<
  'needsUser' | 'question',
  { readonly icon: LucideIcon; readonly label: string }
> = {
  needsUser: { icon: TriangleAlert, label: 'Needs you' },
  question: { icon: MessageCircleQuestionMark, label: 'Waiting on your answer' },
};

type FillParams = {
  readonly fill: Fill;
  readonly tone: Tone;
};

const surfaceClasses = ({ fill, tone }: FillParams): string => {
  const tint = tintClasses(tone);
  if (fill === 'solid') {
    return cn(tint.solid, 'ring-1', tint.ringStrong);
  }
  return cn(TIMELINE_SURFACE_FILL, 'ring-1', tint.ring);
};

const toneWashClasses = ({ fill, tone }: FillParams): string | null => {
  if (fill === 'soft') {
    return tintClasses(tone).bg;
  }
  return null;
};

const glyphClasses = ({ fill, tone }: FillParams): string => {
  if (fill === 'solid') {
    return 'text-current';
  }
  if (fill === 'hollow') {
    return 'text-muted-foreground/70';
  }
  return tintClasses(tone).icon;
};

export const TimelineMarker = ({ state, grade, hasUnread = false }: Props) => {
  const { markerSize, glyphSize, dotSize } = TIMELINE_RHYTHM.grade[grade];
  const unread = hasUnread ? (
    <span
      className={cn(
        'absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-1 ring-background',
        tintClasses('primary').dot,
      )}
      aria-label="Unseen"
    />
  ) : null;

  if (state === 'needsUser' || state === 'question') {
    const { icon, label } = SHAPE[state];
    return (
      <TimelineEmphasisMarker icon={icon} tone="warning" label={label} grade={grade}>
        {unread}
      </TimelineEmphasisMarker>
    );
  }

  const spec = CIRCLE[state];
  const Glyph = spec.icon;
  const wash = toneWashClasses({ fill: spec.fill, tone: spec.tone });
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full',
        surfaceClasses({ fill: spec.fill, tone: spec.tone }),
        state === 'running' && 'spin-border spin-border-info',
      )}
      style={{ width: markerSize, height: markerSize }}
      aria-label={Glyph === null ? spec.label : undefined}
      role={Glyph === null ? 'img' : undefined}
    >
      {wash === null ? null : (
        <span aria-hidden className={cn('absolute inset-0 rounded-full', wash)} />
      )}
      {Glyph === null ? null : (
        <Glyph
          size={glyphSize}
          strokeWidth={2.5}
          className={cn('relative', glyphClasses({ fill: spec.fill, tone: spec.tone }))}
          aria-label={spec.label}
        />
      )}
      {state === 'running' ? (
        <span
          className={cn(
            'relative rounded-full motion-safe:animate-soft-pulse',
            tintClasses(spec.tone).dot,
          )}
          style={{ width: dotSize, height: dotSize }}
        />
      ) : null}
      {unread}
    </span>
  );
};
