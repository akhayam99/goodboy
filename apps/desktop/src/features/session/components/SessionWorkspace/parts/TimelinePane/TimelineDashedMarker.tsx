import type { ReactNode } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';
import { TIMELINE_SURFACE_FILL } from './timelineLayout';

type Props = {
  readonly tone: Tone;
  readonly grade: TimelineRowGrade;
  readonly children: ReactNode;
};

export const TimelineDashedMarker = ({ tone, grade, children }: Props) => {
  const { markerSize } = TIMELINE_RHYTHM.grade[grade];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border border-dashed',
        TIMELINE_SURFACE_FILL,
        tintClasses(tone).border,
      )}
      style={{ width: markerSize, height: markerSize }}
    >
      {children}
    </span>
  );
};
