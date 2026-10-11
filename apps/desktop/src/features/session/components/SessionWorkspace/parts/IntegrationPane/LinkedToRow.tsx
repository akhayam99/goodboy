import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronDown } from 'lucide-react';
import { cn, PANE_RHYTHM } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { taskIdentityKey } from '../../../../../../shared/utils/taskIdentityKey';
import { ObjectChoiceMenu } from '../../../../../actions/ObjectChoiceMenu';
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
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className={cn('flex min-h-9 shrink-0 items-center gap-3', PANE_RHYTHM.detail.band)}>
      <span className="w-28 shrink-0 text-label text-muted-foreground">Linked to</span>
      <ObjectChoiceMenu
        target={{
          kind: 'task',
          sessionId,
          provider: task.provider,
          externalId: task.externalId,
          projectId: task.projectId ?? null,
          branch: null,
        }}
        actionId="task.moveTo"
        label={`Move ${task.identifier} from ${placement}`}
        tooltip="Move to"
        leadingCurrent="This session"
        anchorClassName="min-w-0"
        triggerClassName="h-6 w-auto max-w-full gap-1 px-2 text-label text-foreground"
        fallback={<span className="min-w-0 truncate text-label text-foreground">{placement}</span>}
      >
        <span className="min-w-0 truncate">{placement}</span>
        <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      </ObjectChoiceMenu>
    </div>
  );
};
