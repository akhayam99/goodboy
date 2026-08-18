import type { LucideIcon } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { TimelineMarker } from './TimelineMarker';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly ariaLabel: string;
  readonly isEmphasised?: boolean;
};

export const TimelineGlyphMarker = ({
  icon: Icon,
  tone,
  ariaLabel,
  isEmphasised = false,
}: Props) => (
  <TimelineMarker tone={tone} isEmphasised={isEmphasised}>
    <Icon size={12} aria-label={ariaLabel} className={tintClasses(tone).icon} />
  </TimelineMarker>
);
