import { cn, Tooltip } from '@goodboy/ui';
import { priorityTone } from '../../../integrations/linear/priorityTone';
import type { TaskPriority } from '../../taskPriorityOf';

type Props = {
  readonly priority: TaskPriority;
};

export const TaskPriorityMark = ({ priority }: Props) => {
  const name = `Priority: ${priority.label}`;
  const mark = priorityTone({ priority: priority.priority });
  return (
    <Tooltip content={name}>
      <span
        role="img"
        aria-label={name}
        data-task-priority={priority.priority}
        className="flex size-4 shrink-0 items-center justify-center"
      >
        <span
          aria-hidden
          className={cn(
            'shrink-0 rounded-full',
            mark.shape === 'dash' ? 'h-0.5 w-1.5' : 'size-1.5',
            mark.tone,
          )}
        />
      </span>
    </Tooltip>
  );
};
