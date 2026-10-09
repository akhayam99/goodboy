import { useShallow } from 'zustand/react/shallow';
import { SkeletonChip } from '@goodboy/ui';
import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { externalTaskLinkKey } from '../../../../../store/slices/sessions/externalTaskLinkKey';
import { LinkedTaskChip } from '../../../../../shared/components/LinkedTaskChip';
import { MoreBranchTasks } from './MoreBranchTasks';

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
  const [first, ...rest] = tasks;
  if (first === undefined) {
    return null;
  }
  if (isSkeleton) {
    return <SkeletonChip key={externalTaskLinkKey({ task: first })} />;
  }
  return (
    <span aria-label={`Tasks on ${branch}`} className="flex min-w-0 shrink-0 items-center gap-1">
      <LinkedTaskChip
        key={externalTaskLinkKey({ task: first })}
        sessionId={sessionId}
        task={first}
        branch={branch}
        branches={[branch]}
        size="xs"
      />
      {rest.length === 0 ? null : (
        <MoreBranchTasks sessionId={sessionId} branch={branch} tasks={rest} />
      )}
    </span>
  );
};
