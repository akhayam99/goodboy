import { GitBranch, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { IntegrationGlyph } from '../../../../../integrations/components/IntegrationGlyph';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { sessionEventGlyph } from '../../../../timeline/sessionEventPresentation';
import { TIMELINE_RHYTHM } from '../../../../timeline/timelineRhythm';
import { TimelineEmphasisMarker } from './TimelineEmphasisMarker';
import { TimelineGlyphMarker } from './TimelineGlyphMarker';
import { TimelineMarker } from './TimelineMarker';

type Props = {
  readonly item: TimelineRowItem;
};

type Glyph = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
};

const ARTIFACT: Record<'branch' | 'answer', Glyph> = {
  branch: { icon: GitBranch, tone: 'neutral', label: 'Branch' },
  answer: { icon: MessageSquare, tone: 'warning', label: 'You answered' },
};

export const TimelineRowMarker = ({ item }: Props) => {
  const { entry, grade } = item;
  const { glyphSize } = TIMELINE_RHYTHM.grade[grade];

  if (entry.kind === 'run' || entry.kind === 'agent') {
    return <TimelineMarker state={item.markerState} grade={grade} hasUnread={item.hasUnread} />;
  }
  if (entry.kind === 'issue') {
    return (
      <TimelineGlyphMarker tone="neutral" grade={grade}>
        <IntegrationGlyph provider={entry.task.provider} size={glyphSize} />
      </TimelineGlyphMarker>
    );
  }
  if (entry.kind === 'event') {
    const eventGlyph = sessionEventGlyph({ kind: entry.event.kind });
    const EventIcon = eventGlyph.icon;
    return (
      <TimelineGlyphMarker tone={eventGlyph.tone} grade={grade}>
        <EventIcon
          size={glyphSize}
          aria-label={eventGlyph.label}
          className={tintClasses(eventGlyph.tone).icon}
        />
      </TimelineGlyphMarker>
    );
  }
  if (entry.kind === 'plan') {
    return (
      <TimelineEmphasisMarker
        icon={CONCEPT_ICONS.plans}
        tone={CONCEPT_TONE.plans}
        label="Plan"
        grade={grade}
      />
    );
  }
  const glyph = ARTIFACT[entry.kind];
  const Icon = glyph.icon;
  return (
    <TimelineGlyphMarker tone={glyph.tone} grade={grade}>
      <Icon size={glyphSize} aria-label={glyph.label} className={tintClasses(glyph.tone).icon} />
    </TimelineGlyphMarker>
  );
};
