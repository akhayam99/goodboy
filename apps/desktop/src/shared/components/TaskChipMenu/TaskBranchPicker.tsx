import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Check, GitBranch, Plus } from 'lucide-react';
import { FOCUS_RING, MenuList, cn, type MenuEntry } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { taskIdentityKey } from '../../utils/taskIdentityKey';
import { ICON_SIZE } from '../conceptIcons';
import { taskBranchPreview } from './taskBranchPreview';
import { taskPlacementLabel } from './taskPlacement';

type Props = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly onWorktree: () => void;
  readonly onClose: () => void;
};

export const TaskBranchPicker = ({ sessionId, task, onWorktree, onClose }: Props) => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const rows = useAppStore(
    useShallow((state) =>
      (state.sessionExternalTasks[sessionId] ?? []).filter(
        (candidate) => taskIdentityKey({ task: candidate }) === taskIdentityKey({ task }),
      ),
    ),
  );
  const assignSessionExternalTask = useAppStore((state) => state.assignSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const preview = useAppStore((state) =>
    taskBranchPreview({
      state,
      sessionId,
      projectId: task.projectId ?? mounts[0]?.projectId,
      task,
    }),
  );
  const source = rows.find((candidate) => candidate.scope !== 'branch') ?? rows[0] ?? task;
  const placed = rows.filter((candidate) => candidate.scope === 'branch');
  const placement = taskPlacementLabel({
    branches: placed.map((candidate) => candidate.branch ?? ''),
  });

  const entries = useMemo<ReadonlyArray<MenuEntry>>(
    () => [
      { kind: 'header', key: 'where', label: placement },
      ...mounts
        .filter((mount) => mount.branch !== '')
        .map((mount): MenuEntry => {
          const isHere = placed.some(
            (candidate) =>
              candidate.branch === mount.branch &&
              (candidate.projectId === undefined || candidate.projectId === mount.projectId),
          );
          return {
            kind: 'item',
            key: `mount:${mount.mountId}`,
            label: mount.branch,
            icon: isHere ? Check : GitBranch,
            description: isHere ? `${task.identifier} is here` : mount.mountName,
            onSelect: async () => {
              if (isHere) {
                return;
              }
              try {
                await assignSessionExternalTask({
                  sessionId,
                  task: source,
                  branch: mount.branch,
                  projectId: mount.projectId,
                });
              } catch (error) {
                void reportError({
                  title: `Couldn't put ${task.identifier} on ${mount.branch}`,
                  error,
                  sessionId,
                });
              }
            },
          };
        }),
    ],
    [
      assignSessionExternalTask,
      mounts,
      placed,
      placement,
      reportError,
      sessionId,
      source,
      task.identifier,
    ],
  );

  return (
    <div className="flex flex-col">
      <span className="px-3 pt-3 text-row text-foreground">
        {`Put ${task.identifier} on a branch`}
      </span>
      <MenuList
        label={`Put ${task.identifier} on a branch`}
        entries={entries}
        onClose={onClose}
        isAutoFocus={false}
      />
      <button
        type="button"
        onClick={onWorktree}
        className={cn(
          'mx-1 mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-left text-label text-foreground hover:bg-hover',
          FOCUS_RING,
        )}
      >
        <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col">
          <span>{`New worktree for ${task.identifier}`}</span>
          {preview === null ? null : (
            <span className="truncate font-mono text-secondary text-muted-foreground">
              {preview}
            </span>
          )}
        </span>
      </button>
      <span className="px-3 pb-3 text-secondary text-muted-foreground">
        {`${task.identifier} stays where it is. A task can sit on several branches.`}
      </span>
    </div>
  );
};
