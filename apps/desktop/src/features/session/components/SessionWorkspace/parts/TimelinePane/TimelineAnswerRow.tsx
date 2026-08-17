import { MessageSquare } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';
import type { TimelineAnswerEntry } from '../../../../timeline/buildTimelineGroups';
import { TimelineRow } from './TimelineRow';

type Props = {
  readonly entry: TimelineAnswerEntry;
  readonly timeLabel: string | null;
  readonly onOpen?: () => void;
  readonly hasRoleColumn: boolean;
};

export const TimelineAnswerRow = ({ entry, timeLabel, onOpen, hasRoleColumn }: Props) => {
  const tint = tintClasses('warning');
  return (
    <TimelineRow
      timeLabel={timeLabel}
      depth={entry.depth}
      hasRoleColumn={hasRoleColumn}
      marker={<MessageSquare size={10} aria-hidden className={tint.icon} />}
      onClick={onOpen}
      ariaLabel="You answered an open question"
      label={
        <>
          <span className="shrink-0 text-xs text-muted-foreground">You answered</span>
          <span className="min-w-0 truncate text-sm text-foreground">{entry.question.text}</span>
        </>
      }
    />
  );
};
