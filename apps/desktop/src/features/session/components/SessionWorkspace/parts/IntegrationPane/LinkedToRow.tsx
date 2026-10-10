import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Check, ChevronDown } from 'lucide-react';
import {
  AnchoredPopover,
  cn,
  MenuList,
  MenuTriggerButton,
  PANE_RHYTHM,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { taskIdentityKey } from '../../../../../../shared/utils/taskIdentityKey';
import { taskMoveTargets, type TaskMoveChoice } from '../../../../../actions/kinds/taskMoveTargets';

type Props = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
};

type PlacementParams = {
  readonly rows: ReadonlyArray<SessionExternalTask>;
  readonly choices: ReadonlyArray<TaskMoveChoice>;
};

const placementOf = ({ rows, choices }: PlacementParams): string => {
  const held = rows.flatMap((row) => {
    if (row.scope !== 'branch') {
      return ['This session'];
    }
    const choice = choices.find(
      (candidate) => candidate.to.kind === 'branch' && candidate.to.branch === row.branch,
    );
    return [choice?.label ?? row.branch ?? ''];
  });
  return [...new Set(held)].join(', ');
};

export const LinkedToRow = ({ sessionId, task }: Props) => {
  const rows = useAppStore(
    useShallow((state) =>
      (state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY).filter(
        (row) => taskIdentityKey({ task: row }) === taskIdentityKey({ task }),
      ),
    ),
  );
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const projects = useAppStore((state) => state.projects);
  const moveSessionExternalTask = useAppStore((state) => state.moveSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const dropdown = useDropdown({
    align: 'start',
    width: 'min-w-[240px] max-w-sm',
    expectedHeight: 280,
    expectedWidth: 280,
  });
  const choices = useMemo(
    () =>
      taskMoveTargets({
        rows,
        mounts,
        projectNames: Object.fromEntries(
          projects.map((project) => [project.id, project.name] as const),
        ),
        branch: null,
      }),
    [rows, mounts, projects],
  );
  const placement = placementOf({ rows, choices });
  const { close } = dropdown;
  const entries = useMemo<ReadonlyArray<MenuEntry>>(
    () => [
      { kind: 'header', key: 'title', label: 'Move to' },
      ...choices.map((choice): MenuEntry => ({
        kind: 'item',
        key: choice.id,
        label: choice.label,
        ...(choice.isCurrent ? { icon: Check } : {}),
        onSelect: async () => {
          const source = rows.find((row) => row.scope !== 'branch') ?? rows[0];
          if (source === undefined || choice.isCurrent) {
            return;
          }
          try {
            await moveSessionExternalTask({
              sessionId,
              task: { ...source, scope: 'session' },
              to: choice.to,
            });
          } catch (error) {
            await reportError({ title: `Couldn't move ${task.identifier}`, error, sessionId });
          }
        },
      })),
    ],
    [choices, rows, moveSessionExternalTask, reportError, sessionId, task.identifier],
  );
  if (rows.length === 0) {
    return null;
  }
  return (
    <div
      className={cn(
        'flex min-h-9 shrink-0 items-center gap-3 border-b border-border-soft',
        PANE_RHYTHM.detail.band,
      )}
    >
      <span className="w-28 shrink-0 text-label text-muted-foreground">Linked to</span>
      {choices.length < 2 ? (
        <span className="min-w-0 truncate text-label text-foreground">{placement}</span>
      ) : (
        <AnchoredPopover
          dropdown={dropdown}
          anchorClassName="min-w-0"
          trigger={
            <MenuTriggerButton
              label={`Move ${task.identifier} from ${placement}`}
              tooltip="Move to"
              isOpen={dropdown.open}
              onClick={dropdown.toggle}
              className="h-6 w-auto max-w-full gap-1 px-2 text-label text-foreground"
            >
              <span className="min-w-0 truncate">{placement}</span>
              <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            </MenuTriggerButton>
          }
        >
          <MenuList label="Move to" entries={entries} onClose={close} />
        </AnchoredPopover>
      )}
    </div>
  );
};
