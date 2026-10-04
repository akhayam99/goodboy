import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button, Eyebrow, IconButton } from '@goodboy/ui';
import type { WorkspaceExternalTask, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { TaskLinkChip } from '../../../../shared/components/TaskLinkChip';
import { ongoingKey } from './ongoingKey';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly filter: string | null;
  readonly onFilter: (key: string | null) => void;
};

export const OngoingTasksRow = ({ workspaceId, filter, onFilter }: Props) => {
  const tasks = useAppStore((state) => state.workspaceExternalTasks[workspaceId] ?? EMPTY_ARRAY);
  const loadWorkspaceExternalTasks = useAppStore((state) => state.loadWorkspaceExternalTasks);
  const unlinkWorkspaceExternalTask = useAppStore((state) => state.unlinkWorkspaceExternalTask);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    void loadWorkspaceExternalTasks({ workspaceId }).catch(() => undefined);
  }, [loadWorkspaceExternalTasks, workspaceId]);

  const unlink = async (task: WorkspaceExternalTask) => {
    if (filter === ongoingKey({ task })) {
      onFilter(null);
    }
    try {
      await unlinkWorkspaceExternalTask({
        workspaceId,
        provider: task.provider,
        externalId: task.externalId,
      });
    } catch (error) {
      void reportError({ title: `Couldn't stop tracking ${task.identifier}`, error, workspaceId });
    }
  };

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Ongoing"
      className="flex min-h-7 shrink-0 flex-wrap items-center gap-2"
    >
      <Eyebrow label="Ongoing" />
      {tasks.map((task) => {
        const key = ongoingKey({ task });
        const isActive = filter === key;
        return (
          <span key={key} className="flex items-center">
            <TaskLinkChip
              provider={task.provider}
              identifier={task.identifier}
              title={task.title}
              isActive={isActive}
              tooltip={isActive ? 'Show every session' : `Show only ${task.identifier}`}
              onClick={() => onFilter(isActive ? null : key)}
            />
            <IconButton
              icon={X}
              variant="ghost"
              label={`Stop tracking ${task.identifier}`}
              tooltip={`Stop tracking ${task.identifier}`}
              onClick={() => void unlink(task)}
            />
          </span>
        );
      })}
      {filter === null ? null : (
        <Button size="sm" variant="ghost" onClick={() => onFilter(null)}>
          Clear
        </Button>
      )}
    </div>
  );
};
