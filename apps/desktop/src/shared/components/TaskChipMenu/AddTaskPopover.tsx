import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Link2, ListPlus } from 'lucide-react';
import { AnchoredPopover, MenuList, useDropdown, type MenuEntry } from '@goodboy/ui';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { MOUNT_ADD_TASK_EVENT, mountEventName } from '../../../features/actions/kinds/mount';
import { linkIssueEventName } from '../../../features/actions/kinds/session';
import { distinctTasks } from './distinctTasks';
import { taskPlacementLabel } from './taskPlacement';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly branch: string;
};

export const AddTaskPopover = ({ sessionId, mountId, projectId, branch }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-80',
    expectedHeight: 280,
    openEvent: mountEventName({ name: MOUNT_ADD_TASK_EVENT, mountId }),
  });
  const rows = useAppStore(useShallow((state) => state.sessionExternalTasks[sessionId] ?? []));
  const assignSessionExternalTask = useAppStore((state) => state.assignSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const { close } = dropdown;

  const entries = useMemo<ReadonlyArray<MenuEntry>>(() => {
    const available = distinctTasks({ tasks: rows })
      .filter(
        (group) =>
          !rows.some(
            (candidate) =>
              candidate.provider === group.task.provider &&
              candidate.externalId === group.task.externalId &&
              candidate.scope === 'branch' &&
              candidate.branch === branch &&
              (candidate.projectId === undefined || candidate.projectId === projectId),
          ),
      )
      .sort((left, right) => Number(left.branches.length > 0) - Number(right.branches.length > 0));
    return [
      { kind: 'header', key: 'title', label: `Add a task to ${branch}` },
      ...(available.length === 0
        ? [
            {
              kind: 'header',
              key: 'empty',
              label: 'Every task in this session is already here.',
            } satisfies MenuEntry,
          ]
        : available.map(({ task, branches }): MenuEntry => ({
            kind: 'item',
            key: `${task.provider}:${task.externalId}`,
            label: `${task.identifier} · ${task.title}`,
            icon: ListPlus,
            description: taskPlacementLabel({ branches }),
            onSelect: async () => {
              try {
                await assignSessionExternalTask({ sessionId, task, branch, projectId });
              } catch (error) {
                void reportError({
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
        key: 'link-other',
        label: 'Link other work',
        icon: Link2,
        description: 'Opens Link work',
        onSelect: () => {
          window.dispatchEvent(new CustomEvent(linkIssueEventName({ sessionId })));
        },
      },
    ];
  }, [assignSessionExternalTask, branch, projectId, reportError, rows, sessionId]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`Add a task to ${branch}`}
      anchorClassName="flex size-0 shrink-0"
      trigger={<span aria-hidden className="size-0" />}
    >
      <MenuList label="Add a task" entries={entries} onClose={close} />
    </AnchoredPopover>
  );
};
