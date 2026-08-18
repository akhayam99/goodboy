import type { ReactNode } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';

type Props = {
  readonly tone: Tone;
  readonly grade: TimelineRowGrade;
  readonly children: ReactNode;
};

export const TimelineGlyphMarker = ({ tone, grade, children }: Props) => {
  const { markerSize } = TIMELINE_RHYTHM.grade[grade];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-background ring-1',
        tintClasses(tone).ring,
      )}
      style={{ width: markerSize, height: markerSize }}
    >
      {children}
    </span>
  );
};
