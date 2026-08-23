import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';
import { TIMELINE_SURFACE_FILL } from './timelineLayout';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
  readonly grade: TimelineRowGrade;
  readonly children?: ReactNode;
};

const HALO_OPACITY = 0.18;

export const TimelineEmphasisMarker = ({ icon: Icon, tone, label, grade, children }: Props) => {
  const { markerSize, glyphSize } = TIMELINE_RHYTHM.grade[grade];
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full ring-1',
        TIMELINE_SURFACE_FILL,
        tintClasses(tone).ring,
      )}
      style={{ width: markerSize, height: markerSize }}
    >
      <Icon
        size={glyphSize}
        strokeWidth={2}
        fill="currentColor"
        fillOpacity={HALO_OPACITY}
        className={cn('relative', tintClasses(tone).icon)}
        aria-label={label}
      />
      {children}
    </span>
  );
};
