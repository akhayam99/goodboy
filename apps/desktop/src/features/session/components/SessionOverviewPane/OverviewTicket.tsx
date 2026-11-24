import { Button, Tooltip } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { IntegrationGlyph } from '../../../../shared/components/IntegrationGlyph';
import { distinctTasks } from '../../../../shared/utils/distinctTasks';
import { ObjectMenuArea } from '../../../actions/components/ObjectMenuArea';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import { taskKeyOf } from '../../../actions/kinds/task';
import type { ObjectTarget } from '../../../actions/types';
import { openLens } from '../../openLens';

type Props = {
  readonly sessionId: SessionId;
};

type OriginParams = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
};

const MENU_OMIT: ReadonlyArray<string> = ['task.open'];

type TaskParams = {
  readonly task: SessionExternalTask;
};

const isSessionScoped = ({ task }: TaskParams): boolean => task.scope !== 'branch';

const originTaskOf = ({ tasks }: OriginParams): SessionExternalTask | null =>
  tasks.find((task) => isSessionScoped({ task }) && task.relation === 'part-of') ??
  tasks.find((task) => isSessionScoped({ task })) ??
  tasks[0] ??
  null;

export const OverviewTicket = ({ sessionId }: Props) => {
  const rows = useAppStore((state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const openExternalTaskLens = useAppStore((state) => state.openExternalTaskLens);
  const tasks = distinctTasks({ tasks: rows }).map(({ task }) => task);
  const origin = originTaskOf({ tasks });
  if (origin === null) {
    return null;
  }
  const target = {
    kind: 'task',
    sessionId,
    provider: origin.provider,
    externalId: origin.externalId,
    projectId: origin.projectId ?? null,
    branch: null,
  } satisfies ObjectTarget;
  const moreCount = tasks.length - 1;
  const openLabel =
    origin.provider === 'sentry'
      ? `Open ${origin.identifier} in Tasks`
      : `Open ${origin.identifier}`;
  const moreLabel = `Open all ${tasks.length} linked tasks`;

  return (
    <span data-overview-ticket="" className="flex min-w-0 items-center gap-1">
      <ObjectMenuArea target={target} anchorKey={`overview:${taskKeyOf(target)}`}>
        <Button
          variant="quiet"
          size="sm"
          intent={actionIntentOf({ verb: openLabel })}
          aria-label={openLabel}
          title={origin.title}
          onClick={() => openExternalTaskLens(sessionId, origin)}
          className="min-w-0 font-normal text-muted-foreground"
        >
          <IntegrationGlyph provider={origin.provider} size="xs" className="shrink-0" />
          <span className="shrink-0 font-mono">{origin.identifier}</span>
          <span className="min-w-0 truncate">{origin.title}</span>
        </Button>
      </ObjectMenuArea>
      <ObjectOverflowMenu
        target={target}
        label={`More actions for ${origin.identifier}`}
        omit={MENU_OMIT}
        align="left"
        anchorKey={`overview-menu:${taskKeyOf(target)}`}
      />
      {moreCount > 0 ? (
        <Tooltip content={moreLabel}>
          <Button
            variant="quiet"
            size="xs"
            intent={actionIntentOf({ verb: moreLabel })}
            aria-label={moreLabel}
            onClick={() => openLens({ sessionId, lens: 'context' })}
            className="font-normal tabular-nums"
          >
            {`+${moreCount}`}
          </Button>
        </Tooltip>
      ) : null}
    </span>
  );
};
