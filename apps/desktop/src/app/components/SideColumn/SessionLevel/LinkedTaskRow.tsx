import { SelectableRow } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { IntegrationGlyph } from '../../../../features/integrations/components/IntegrationGlyph';
import { ObjectMenuArea } from '../../../../features/actions/components/ObjectMenuArea';
import { taskKeyOf } from '../../../../features/actions/kinds/task';
import type { ObjectTarget } from '../../../../features/actions/types';
import { useTaskDrag } from '../../../../features/session/hooks/useTaskDrag';
import { taskPlacementLabel } from '../../../../shared/utils/taskPlacementLabel';

type Props = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly branches: ReadonlyArray<string>;
  readonly isShown: boolean;
};

export const LinkedTaskRow = ({ sessionId, task, branches, isShown }: Props) => {
  const openExternalTaskLens = useAppStore((state) => state.openExternalTaskLens);
  const drag = useTaskDrag({ sessionId, task, branch: null });
  const target = {
    kind: 'task',
    sessionId,
    provider: task.provider,
    externalId: task.externalId,
    projectId: task.projectId ?? null,
    branch: null,
  } satisfies ObjectTarget;
  const placement = branches.length === 0 ? null : taskPlacementLabel({ branches });

  return (
    <ObjectMenuArea target={target} anchorKey={taskKeyOf(target)}>
      <div onPointerDown={drag.onPointerDown}>
        <SelectableRow
          selected={isShown}
          ariaCurrent={isShown ? 'page' : undefined}
          ariaLabel={
            placement === null
              ? `Open ${task.identifier}`
              : `Open ${task.identifier} ${placement.replace('On ', 'on ')}`
          }
          title={placement === null ? task.title : `${task.title}. ${placement}`}
          onClick={() => openExternalTaskLens(sessionId, task)}
          className="h-7 items-center gap-2 px-2 text-label"
        >
          <IntegrationGlyph provider={task.provider} size="xs" className="shrink-0" />
          <span className="shrink-0 text-code text-muted-foreground">{task.identifier}</span>
          <span className="min-w-0 flex-1 truncate">{task.title}</span>
        </SelectableRow>
      </div>
    </ObjectMenuArea>
  );
};
