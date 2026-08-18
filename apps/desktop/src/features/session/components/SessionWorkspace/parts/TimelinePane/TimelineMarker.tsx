import { Check, Clock, MessageCircleQuestionMark, Minus, TriangleAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { TimelineMarkerState } from '../../../../timeline/markerState';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';

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

const fillClasses = ({ fill, tone }: { readonly fill: Fill; readonly tone: Tone }): string => {
  const tint = tintClasses(tone);
  if (fill === 'solid') {
    return cn(tint.solid, 'ring-1', tint.ringStrong);
  }
  if (fill === 'soft') {
    return cn(tint.bg, 'ring-1', tint.ring);
  }
  return cn('bg-background ring-1', tint.ring);
};

const glyphClasses = ({ fill, tone }: { readonly fill: Fill; readonly tone: Tone }): string => {
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
    const { icon: Icon, label } = SHAPE[state];
    return (
      <span className="relative inline-flex items-center justify-center">
        <span
          className="absolute rounded-full bg-background"
          style={{ width: markerSize, height: markerSize }}
        />
        <Icon
          size={markerSize + 4}
          strokeWidth={2}
          fill="currentColor"
          fillOpacity={0.18}
          className="relative text-warning"
          aria-label={label}
        />
        {unread}
      </span>
    );
  }

  const spec = CIRCLE[state];
  const Glyph = spec.icon;
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full',
        fillClasses({ fill: spec.fill, tone: spec.tone }),
        state === 'running' && 'spin-border spin-border-info',
      )}
      style={{ width: markerSize, height: markerSize }}
      aria-label={Glyph === null ? spec.label : undefined}
      role={Glyph === null ? 'img' : undefined}
    >
      {Glyph === null ? null : (
        <Glyph
          size={glyphSize}
          strokeWidth={2.5}
          className={glyphClasses({ fill: spec.fill, tone: spec.tone })}
          aria-label={spec.label}
        />
      )}
      {state === 'running' ? (
        <span
          className={cn('rounded-full motion-safe:animate-soft-pulse', tintClasses(spec.tone).dot)}
          style={{ width: dotSize, height: dotSize }}
        />
      ) : null}
      {unread}
    </span>
  );
};
