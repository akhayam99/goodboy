import type { Agent, SessionId } from '@goodboy/types';
import { Button, Notice, cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoTreeLive } from '../../live-state/adapters/autoTreeLive';
import { autoGlanceOf } from '../glance/autoGlanceOf';
import { useAutoTreeActions } from './useAutoTreeActions';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
};

export const AutoDockLive = ({ sessionId, view, rootAgent }: Props) => {
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgent.id] ?? null);
  const actions = useAutoTreeActions({ sessionId });
  const glance = autoGlanceOf({ view, rootTurn });
  if (glance.state !== 'working' && glance.state !== 'planning') {
    return null;
  }
  const facts = autoTreeLive({ view, rootTurn, rootAgent, lastTool: null, project: null });
  const ids = facts?.actions.map((action) => action.id) ?? [];
  const canChange = ids.includes('changeApproach');
  const canStop = ids.includes('stopAuto') && !canChange;
  return (
    <div data-dock-live="" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-h-7 min-w-0 items-center gap-2 text-meta">
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full motion-safe:animate-soft-pulse',
            tintClasses(glance.tone).dot,
          )}
        />
        <span className="min-w-0 truncate text-muted-foreground">{glance.sentence}</span>
        <span className="flex-1" />
        {canChange ? (
          <Button variant="quiet" size="xs" onClick={() => void actions.changeApproach({ view })}>
            Change approach
          </Button>
        ) : null}
        {canStop ? (
          <Button
            variant="quiet"
            size="xs"
            disabled={actions.isStopping}
            onClick={() => void actions.stop({ view })}
          >
            Stop
          </Button>
        ) : null}
      </div>
      {actions.failure === null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={actions.failure.title}
          body={actions.failure.message}
        />
      )}
    </div>
  );
};
