import { AnchoredPopover, Chip, useDropdown } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { externalTaskLinkKey } from '../../../../../store/slices/sessions/externalTaskLinkKey';
import { LinkedTaskChip } from '../../../../../shared/components/LinkedTaskChip';

type Props = {
  readonly sessionId: SessionId;
  readonly branch: string;
  readonly tasks: ReadonlyArray<SessionExternalTask>;
};

export const MoreBranchTasks = ({ sessionId, branch, tasks }: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'w-80', expectedHeight: 160 });
  const label = `More tasks on ${branch}`;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={label}
      anchorClassName="flex shrink-0"
      trigger={
        <Chip
          as="button"
          tone="neutral"
          bordered={false}
          shape="badge"
          size="xs"
          ariaLabel={label}
          expanded={dropdown.open}
          hasPopup="dialog"
          onClick={dropdown.toggle}
          title={tasks.map((task) => task.identifier).join(', ')}
          label={`+${tasks.length}`}
        />
      }
    >
      <div className="flex flex-col items-start gap-1 p-2">
        {tasks.map((task) => (
          <LinkedTaskChip
            key={externalTaskLinkKey({ task })}
            sessionId={sessionId}
            task={task}
            branch={branch}
            branches={[branch]}
            size="xs"
          />
        ))}
      </div>
    </AnchoredPopover>
  );
};
