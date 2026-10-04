import { X } from 'lucide-react';
import { IconButton, chipClasses, cn, type ChipSize } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store/store';
import { ObjectMenuArea } from '../../features/actions/components/ObjectMenuArea';
import { taskKeyOf } from '../../features/actions/kinds/task';
import type { ObjectTarget } from '../../features/actions/types';
import { taskPlacementLabel } from '../utils/taskPlacementLabel';
import { TaskLinkChip } from './TaskLinkChip';

type Props = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly branch: string | null;
  readonly branches: ReadonlyArray<string>;
  readonly size?: ChipSize;
};

export const LinkedTaskChip = ({ sessionId, task, branch, branches, size = 'control' }: Props) => {
  const openExternalTaskLens = useAppStore((state) => state.openExternalTaskLens);
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const takeOffSessionExternalTask = useAppStore((state) => state.takeOffSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const target = {
    kind: 'task',
    sessionId,
    provider: task.provider,
    externalId: task.externalId,
    projectId: task.projectId ?? null,
    branch,
  } satisfies ObjectTarget;
  const placement = taskPlacementLabel({ branches });
  const unlink = async () => {
    try {
      if (branch !== null) {
        await takeOffSessionExternalTask({ sessionId, task });
        return;
      }
      await unlinkSessionExternalTask(sessionId, task.provider, task.externalId, task.projectId);
    } catch (error) {
      await reportError({ title: `Couldn't unlink ${task.identifier}`, error, sessionId });
    }
  };
  return (
    <ObjectMenuArea target={target} anchorKey={taskKeyOf(target)}>
      <span
        className={cn(
          'group/task-link shrink-0',
          chipClasses({ tone: 'neutral', shape: 'badge', size }),
        )}
      >
        <TaskLinkChip
          provider={task.provider}
          identifier={task.identifier}
          isOnBranch={branches.length > 0}
          extraBranches={branch === null ? Math.max(branches.length - 1, 0) : 0}
          size={size}
          isBordered={false}
          className="bg-transparent px-0"
          tooltip={`${task.identifier}: ${task.title}. ${placement}`}
          ariaLabel={
            branches.length === 0
              ? `Open ${task.identifier}`
              : `Open ${task.identifier} ${placement.replace('On ', 'on ')}`
          }
          onClick={() => openExternalTaskLens(sessionId, task)}
        />
        <IconButton
          icon={X}
          iconSize={11}
          variant="ghost"
          label={`Unlink ${task.identifier}${branch === null ? ' from session' : ` from ${branch}`}`}
          tooltip="Unlink"
          onClick={() => void unlink()}
          className="pointer-events-none size-4 shrink-0 p-0 opacity-0 group-hover/task-link:pointer-events-auto group-hover/task-link:opacity-100 group-focus-within/task-link:pointer-events-auto group-focus-within/task-link:opacity-100 hover:text-danger"
        />
      </span>
    </ObjectMenuArea>
  );
};
