import { useEffect, useState } from 'react';
import type { ChipSize } from '@goodboy/ui';
import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ObjectMenuArea } from '../../../actions/components/ObjectMenuArea';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { TASK_PUT_EVENT, taskEventName, taskKeyOf } from '../../../actions/kinds/task';
import type { ObjectTarget } from '../../../actions/types';
import { TaskLinkChip } from '../../../../shared/components/TaskLinkChip';
import { TaskBranchPicker } from './TaskBranchPicker';
import { TaskWorktreeForm } from './TaskWorktreeForm';
import { taskPlacementLabel } from './taskPlacement';

type Props = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly branch: string | null;
  readonly branches: ReadonlyArray<string>;
  readonly size?: ChipSize;
};

export const TaskChipMenu = ({ sessionId, task, branch, branches, size = 'control' }: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'w-80', expectedHeight: 320 });
  const openExternalTaskLens = useAppStore((state) => state.openExternalTaskLens);
  const [view, setView] = useState<'put' | 'worktree'>('put');
  const { open: isOpen, toggle } = dropdown;
  const target = {
    kind: 'task',
    sessionId,
    provider: task.provider,
    externalId: task.externalId,
    branch,
  } satisfies ObjectTarget;
  const key = taskKeyOf(target);
  const placement = taskPlacementLabel({ branches });

  useEffect(() => {
    const name = taskEventName({ name: TASK_PUT_EVENT, key });
    const onOpen = () => {
      if (!isOpen) {
        toggle();
      }
    };
    window.addEventListener(name, onOpen);
    return () => window.removeEventListener(name, onOpen);
  }, [isOpen, key, toggle]);

  useEffect(() => {
    if (!isOpen) {
      setView('put');
    }
  }, [isOpen]);

  return (
    <ObjectMenuArea target={target} anchorKey={key}>
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel={`Put ${task.identifier} on a branch`}
        anchorClassName="flex shrink-0"
        trigger={
          <span className="flex shrink-0 items-center gap-0.5">
            <TaskLinkChip
              provider={task.provider}
              identifier={task.identifier}
              isOnBranch={branches.length > 0}
              extraBranches={branch === null ? Math.max(branches.length - 1, 0) : 0}
              size={size}
              tooltip={`${task.identifier}: ${task.title}. ${placement}`}
              ariaLabel={
                branches.length === 0
                  ? `Open ${task.identifier}`
                  : `Open ${task.identifier} ${placement.replace('On ', 'on ')}`
              }
              onClick={() => openExternalTaskLens(sessionId, task)}
            />
            <ObjectOverflowMenu
              target={target}
              label={`Actions for ${task.identifier}`}
              anchorKey={key}
              align="left"
            />
          </span>
        }
      >
        {view === 'put' ? (
          <TaskBranchPicker
            sessionId={sessionId}
            task={task}
            onWorktree={() => setView('worktree')}
            onClose={dropdown.close}
          />
        ) : (
          <TaskWorktreeForm
            sessionId={sessionId}
            task={task}
            onBack={() => setView('put')}
            onDone={dropdown.close}
          />
        )}
      </AnchoredPopover>
    </ObjectMenuArea>
  );
};
