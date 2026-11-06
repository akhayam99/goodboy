import type { Agent, SessionId } from '@goodboy/types';
import { Notice } from '@goodboy/ui';
import { DockStateLine } from '../../../shared/components/DockStateLine';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoTreeLive } from '../../live-state/adapters/autoTreeLive';
import { autoGlanceOf } from '../glance/autoGlanceOf';
import { AutoDockAttention } from './AutoDockAttention';
import type { AutoTreeActions } from './useAutoTreeActions';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
  readonly actions: AutoTreeActions;
};

export const AutoDockLive = ({ sessionId, view, rootAgent, actions }: Props) => {
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgent.id] ?? null);
  const isRootLive = rootTurn?.kind === 'running' || rootTurn?.kind === 'starting';
  const facts = isRootLive
    ? null
    : autoTreeLive({ view, rootTurn, rootAgent, lastTool: null, project: null });
  const isAttention = facts?.state === 'paused' || facts?.state === 'failed';
  const isStoppedUnannounced = facts?.state === 'stopped' && rootAgent.status !== 'stopped';
  if (!isAttention && !isStoppedUnannounced && actions.failure === null) {
    return null;
  }
  const glance = autoGlanceOf({ view, rootTurn });
  return (
    <div data-dock-state="" className="flex min-w-0 flex-col gap-1">
      {facts !== null && isAttention ? (
        <AutoDockAttention
          sessionId={sessionId}
          view={view}
          rootAgent={rootAgent}
          facts={facts}
          tone={glance.tone}
          actions={actions}
        />
      ) : null}
      {isStoppedUnannounced ? (
        <DockStateLine state="stopped" tone={glance.tone} sentence={glance.sentence} />
      ) : null}
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
