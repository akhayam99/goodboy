import { NAMES } from '../../../../shared/names';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Link2, ListPlus, Plus } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  Chip,
  MenuList,
  cn,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import type { MountId, ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { MOUNT_PUT_TASK_EVENT, mountEventName } from '../../../actions/kinds/mount';
import { linkIssueEventName } from '../../../actions/kinds/session';
import { taskIdentityKey } from '../../../../shared/utils/taskIdentityKey';
import { distinctTasks } from '../../../../shared/utils/distinctTasks';
import { taskPlacementLabel } from '../../../../shared/utils/taskPlacementLabel';
import { TaskWorktreeForm } from './TaskWorktreeForm';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly branch: string;
};

export const PutOnBranchPopover = ({ sessionId, mountId, projectId, branch }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-80',
    expectedHeight: 280,
    openEvent: mountEventName({ name: MOUNT_PUT_TASK_EVENT, mountId }),
  });
  const rows = useAppStore(useShallow((state) => state.sessionExternalTasks[sessionId] ?? []));
  const assignSessionExternalTask = useAppStore((state) => state.assignSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const [worktreeTask, setWorktreeTask] = useState<SessionExternalTask | null>(null);
  const { close, open: isOpen } = dropdown;
  const groups = useMemo(
    () =>
      distinctTasks({ tasks: rows }).filter(
        ({ task }) => task.projectId === undefined || task.projectId === projectId,
      ),
    [projectId, rows],
  );
  useEffect(() => {
    if (!isOpen) {
      setWorktreeTask(null);
    }
  }, [isOpen]);
  const available = useMemo(
    () =>
      groups.filter(
        ({ task }) =>
          !rows.some(
            (candidate) =>
              taskIdentityKey({ task: candidate }) === taskIdentityKey({ task }) &&
              candidate.scope === 'branch' &&
              candidate.branch === branch,
          ),
      ),
    [branch, groups, rows],
  );
  const entries = useMemo<ReadonlyArray<MenuEntry>>(() => {
    return [
      { kind: 'header', key: 'title', label: `Put work on ${branch}` },
      ...(available.length === 0
        ? [
            {
              kind: 'header',
              key: 'empty',
              label:
                groups.length === 0
                  ? 'Link work to this session first.'
                  : 'Every linked task is already here.',
            } satisfies MenuEntry,
          ]
        : available.map(({ task, branches }): MenuEntry => ({
            kind: 'item',
            key: taskIdentityKey({ task }),
            label: `${task.identifier} · ${task.title}`,
            icon: ListPlus,
            description: taskPlacementLabel({ branches }),
            onSelect: async () => {
              try {
                await assignSessionExternalTask({ sessionId, task, branch, projectId });
              } catch (error) {
                await reportError({
                  title: `Couldn't put ${task.identifier} on ${branch}`,
                  error,
                  sessionId,
                });
              }
            },
          }))),
      { kind: 'separator', key: 'sep' },
      {
        kind: 'item',
        key: 'link-work',
        label: 'Link work',
        icon: Link2,
        onSelect: () => {
          window.dispatchEvent(new CustomEvent(linkIssueEventName({ sessionId })));
        },
      },
    ];
  }, [assignSessionExternalTask, available, branch, groups, projectId, reportError, sessionId]);
  if (available.length === 0 && !isOpen) {
    return null;
  }
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Put on a branch"
      anchorClassName="flex shrink-0"
      trigger={
        <Chip
          as="button"
          tone="neutral"
          bordered={false}
          shape="badge"
          kind="reference"
          ariaLabel={`Put on a branch ${branch}`}
          expanded={isOpen}
          hasPopup="dialog"
          onClick={dropdown.toggle}
          title="Put on a branch"
          icon={<Plus size={ICON_SIZE.row} aria-hidden />}
          className={cn(
            'w-6 justify-center px-0 opacity-0 focus-visible:opacity-100 group-hover/mount-row:opacity-100 group-focus-within/mount-row:opacity-100',
            isOpen && 'opacity-100',
          )}
        />
      }
    >
      {worktreeTask === null ? (
        <div className="flex flex-col gap-2">
          <MenuList label="Put on a branch" entries={entries} onClose={close} />
          {groups.length === 0 ? null : (
            <div className="flex flex-col gap-1 p-2">
              {groups.map(({ task }) => (
                <Button
                  key={taskIdentityKey({ task })}
                  size="sm"
                  variant="ghost"
                  onClick={() => setWorktreeTask(task)}
                >{`${NAMES.newBranch} for ${task.identifier}`}</Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <TaskWorktreeForm
          sessionId={sessionId}
          task={worktreeTask}
          onBack={() => setWorktreeTask(null)}
          onDone={close}
        />
      )}
    </AnchoredPopover>
  );
};
