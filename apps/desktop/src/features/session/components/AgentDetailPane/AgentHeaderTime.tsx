import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { WorkTime } from '../../../workTreeModel/workTime';

type Props = {
  readonly time: WorkTime;
};

export const AgentHeaderTime = ({ time }: Props) => {
  const { note } = time;
  return (
    <>
      <Tooltip content={note === null ? time.detail : `${note}. ${time.detail}`}>
        <span
          data-testid="agent-header-time"
          data-note={note === null ? undefined : 'true'}
          className={cn(
            'shrink-0 text-meta tabular-nums text-muted-foreground',
            note !== null && tintClasses('warning').text,
          )}
        >
          {note === null ? time.headline : time.label}
        </span>
      </Tooltip>
      {note === null ? null : <span className="sr-only">{note}</span>}
    </>
  );
};
