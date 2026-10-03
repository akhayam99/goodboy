import { useShallow } from 'zustand/react/shallow';
import { SkeletonChip } from '@goodboy/ui';
import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { externalTaskLinkKey } from '../../../../../store/slices/sessions/externalTaskLinkKey';
import { TaskLinkChip } from '../../../../../shared/components/TaskLinkChip';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly isSkeleton: boolean;
};

export const BranchTaskChips = ({ sessionId, projectId, branch, isSkeleton }: Props) => {
  const tasks = useAppStore(
    useShallow((state) =>
      (state.sessionExternalTasks[sessionId] ?? []).filter(
        (task) =>
          task.scope === 'branch' &&
          task.branch === branch &&
          (task.projectId === undefined || task.projectId === projectId),
      ),
    ),
  );
  const openExternalTaskLens = useAppStore((state) => state.openExternalTaskLens);
  if (tasks.length === 0) {
    return null;
  }
  return (
    <span aria-label={`Tasks on ${branch}`} className="flex shrink-0 items-center gap-1">
      {tasks.map((task) =>
        isSkeleton ? (
          <SkeletonChip key={externalTaskLinkKey({ task })} />
        ) : (
          <TaskLinkChip
            key={externalTaskLinkKey({ task })}
            provider={task.provider}
            identifier={task.identifier}
            size="xs"
            tooltip={`${task.identifier} on ${branch}: ${task.title}`}
            ariaLabel={`Open ${task.identifier} on ${branch}`}
            onClick={() => openExternalTaskLens(sessionId, task)}
          />
        ),
      )}
    </span>
  );
};
