import { MessageSquare } from 'lucide-react';
import type { TimelineAnswerEntry } from '../../../../timeline/buildTimelineGroups';
import type { RunIdentity } from '../../../../timeline/runIdentity';
import { TimelineGlyphMarker } from './TimelineGlyphMarker';
import type { TimelineDepth } from '../../../../timeline/flattenTimelineRows';
import { TimelineRow } from './TimelineRow';

type Props = {
  readonly entry: TimelineAnswerEntry;
  readonly indent: TimelineDepth;
  readonly identity: RunIdentity | null;
  readonly onOpen: () => void;
};

export const TimelineAnswerRow = ({ entry, indent, identity, onOpen }: Props) => (
  <TimelineRow
    timeLabel={null}
    indent={indent}
    identity={identity}
    marker={<TimelineGlyphMarker icon={MessageSquare} tone="warning" ariaLabel="You answered" />}
    label={
      <>
        <span className="shrink-0 text-xs text-muted-foreground">You answered</span>
        <span className="min-w-0 truncate text-sm text-foreground">{entry.question.text}</span>
      </>
    }
    navigation={{ label: 'Open chat', onNavigate: onOpen }}
  />
);
