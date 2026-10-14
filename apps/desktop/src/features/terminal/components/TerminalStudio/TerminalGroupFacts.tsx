import type { SessionId } from '@goodboy/types';
import { Chip } from '@goodboy/ui';
import { DiffStat } from '../../../../shared/components/DiffStat';
import { LinkedTaskChip } from '../../../../shared/components/LinkedTaskChip';
import { TaskLinkChip } from '../../../../shared/components/TaskLinkChip';
import { distinctTasks } from '../../../../shared/utils/distinctTasks';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useMountDiffStats } from '../../../../store/slices/project-mounts/useMountDiffStats';

type Props = {
  readonly sessionId: SessionId;
  readonly size?: 'xs' | 'sm';
  readonly isStatic?: boolean;
};

const VISIBLE_TASKS = 2;

export const TerminalGroupFacts = ({ sessionId, size = 'xs', isStatic = false }: Props) => {
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const stats = useMountDiffStats(sessionId);
  const tasks = distinctTasks({ tasks: externalTasks }).filter(
    ({ task }) => task.scope !== 'branch',
  );
  let additions = 0;
  let deletions = 0;
  for (const stat of stats.values()) {
    additions += stat.additions;
    deletions += stat.deletions;
  }
  const hidden = tasks.length - VISIBLE_TASKS;
  if (tasks.length === 0 && additions === 0 && deletions === 0) {
    return null;
  }
  return (
    <div aria-label="Linked work and changes" className="flex min-w-0 flex-wrap items-center gap-1">
      {tasks
        .slice(0, VISIBLE_TASKS)
        .map(({ task, branches }) =>
          isStatic ? (
            <TaskLinkChip
              key={`${task.provider}:${task.externalId}`}
              provider={task.provider}
              identifier={task.identifier}
              tooltip={`${task.identifier}: ${task.title}`}
              size={size}
            />
          ) : (
            <LinkedTaskChip
              key={`${task.provider}:${task.externalId}`}
              sessionId={sessionId}
              task={task}
              branch={null}
              branches={branches}
              size={size}
            />
          ),
        )}
      {hidden > 0 ? <Chip tone="neutral" kind="count" label={`+${hidden}`} /> : null}
      <DiffStat additions={additions} deletions={deletions} />
    </div>
  );
};
