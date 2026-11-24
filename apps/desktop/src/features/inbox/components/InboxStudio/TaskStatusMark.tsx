import { cn, ICON_SIZE, tintClasses, Tooltip } from '@goodboy/ui';
import { INBOX_STATE_PRESENTATION } from '../../../../shared/components/StudioDetail/RecordState';
import type { InboxRecord } from '../../types';

type Props = {
  readonly record: InboxRecord;
};

export const TaskStatusMark = ({ record }: Props) => {
  const { icon: Icon, tone } = INBOX_STATE_PRESENTATION[record.state];
  const name = `Status: ${record.stateLabel}`;
  return (
    <Tooltip content={name}>
      <span
        role="img"
        aria-label={name}
        data-task-status={record.state}
        className="flex size-4 shrink-0 items-center justify-center"
      >
        <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', tintClasses(tone).icon)} />
      </span>
    </Tooltip>
  );
};
