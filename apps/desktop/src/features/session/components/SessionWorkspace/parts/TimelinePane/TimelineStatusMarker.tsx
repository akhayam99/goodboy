import { AlertTriangle, Check, Clock, Minus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { TimelineGlyphMarker } from './TimelineGlyphMarker';
import { TimelineMarker } from './TimelineMarker';

export type TimelineMarkerState = Agent['status'] | 'waiting';

type SettledState = Exclude<TimelineMarkerState, 'running'>;

const STATE_GLYPH: Record<SettledState, LucideIcon> = {
  completed: Check,
  skipped: Minus,
  failed: X,
  pending: Clock,
  waiting: AlertTriangle,
};

const STATE_TONE: Record<SettledState, Tone> = {
  completed: 'success',
  skipped: 'neutral',
  failed: 'danger',
  pending: 'neutral',
  waiting: 'warning',
};

const STATE_LABEL: Record<TimelineMarkerState, string> = {
  running: 'Running',
  completed: 'Completed',
  skipped: 'Skipped',
  failed: 'Failed',
  pending: 'Not started',
  waiting: 'Waiting for you',
};

type Props = {
  readonly state: TimelineMarkerState;
};

export const TimelineStatusMarker = ({ state }: Props) => {
  if (state === 'running') {
    return (
      <TimelineMarker tone="info" isEmphasised>
        <StatusDot tone="info" size="md" pulsing ariaLabel={STATE_LABEL.running} />
      </TimelineMarker>
    );
  }
  return (
    <TimelineGlyphMarker
      icon={STATE_GLYPH[state]}
      tone={STATE_TONE[state]}
      ariaLabel={STATE_LABEL[state]}
      isEmphasised={state === 'waiting' || state === 'failed'}
    />
  );
};
