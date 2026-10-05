import { useShallow } from 'zustand/react/shallow';
import { SkeletonChip } from '@goodboy/ui';
import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { externalTaskLinkKey } from '../../../../../store/slices/sessions/externalTaskLinkKey';
import { LinkedTaskChip } from '../../../../../shared/components/LinkedTaskChip';

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
  if (tasks.length === 0) {
    return null;
  }
  return (
    <span
      aria-label={`Tasks on ${branch}`}
      className="flex min-w-0 max-w-full flex-wrap items-center gap-1"
    >
      {tasks.map((task) =>
        isSkeleton ? (
          <SkeletonChip key={externalTaskLinkKey({ task })} />
        ) : (
          <LinkedTaskChip
            key={externalTaskLinkKey({ task })}
            sessionId={sessionId}
            task={task}
            branch={branch}
            branches={[branch]}
            size="xs"
          />
        ),
      )}
    </span>
  );
};
