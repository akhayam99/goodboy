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

const EMPHASIS_GROWTH = 4;
const HALO_OPACITY = 0.18;

export const TimelineEmphasisMarker = ({ icon: Icon, tone, label, grade, children }: Props) => {
  const emphasisSize = TIMELINE_RHYTHM.grade[grade].markerSize + EMPHASIS_GROWTH;
  return (
    <span className="relative inline-flex items-center justify-center">
      <span
        aria-hidden
        className={cn('absolute rounded-full', TIMELINE_SURFACE_FILL)}
        style={{ width: emphasisSize, height: emphasisSize }}
      />
      <Icon
        size={emphasisSize}
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
