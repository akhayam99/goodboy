import { useState } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { useConversationAsks } from '../../../store/hooks/useConversationAsks';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoTreeWordOf } from '../autoTreeWordOf';
import { dockPlanOf } from '../dockPlanOf';
import { planDiscardAskOf } from '../planDiscardAskOf';
import { askBarsOf } from './askBarOf';
import { AutoDockAsk } from './AutoDockAsk';
import { AutoDockHold } from './AutoDockHold';
import { AutoDockLive } from './AutoDockLive';
import { AutoDockPlan } from './AutoDockPlan';
import { AutoNextAction } from './AutoNextAction';
import { AutoProjectAsk } from './AutoProjectAsk';
import { dockNextStepOf } from './dockNextStepOf';
import { projectAskOf } from './projectAskOf';
import type { AutoTreeActions } from './useAutoTreeActions';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
  readonly onOpenArtifact: (artifactId: string) => void;
  readonly actions: AutoTreeActions;
};

const AT_REST: ReadonlySet<AutoTreeView['tree']['phase']> = new Set([
  'answering',
  'done',
  'finished',
]);

export const AutoDock = ({ sessionId, view, rootAgent, onOpenArtifact, actions }: Props) => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const { permissions, questions } = useConversationAsks({ sessionId, agentId: rootAgent.id });
  const [untold, setUntold] = useState<Readonly<Record<string, string>>>({});
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgent.id] ?? null);
  const hasAskAbove = permissions.length > 0 || questions.length > 0;
  const isHoldShown =
    !hasAskAbove &&
    view.hold != null &&
    autoTreeWordOf({ view, rootTurn }).lead.stop === 'waitsForYou';
  const plan = dockPlanOf({ view });
  const isPlanWaiting = plan?.kind === 'waiting';
  const nextStep = dockNextStepOf({ view, agents, untold });
  const isRevisionAsked = nextStep !== null && nextStep.reviseOf === plan?.row.artifact.artifactId;
  const isNextShown =
    !hasAskAbove && !isHoldShown && nextStep !== null && (!isPlanWaiting || isRevisionAsked);
  const projectAsk =
    hasAskAbove || isHoldShown || isPlanWaiting || isNextShown ? null : projectAskOf({ view });
  const asks = askBarsOf({ view });
  const askBar =
    hasAskAbove || isHoldShown || isPlanWaiting || isNextShown || projectAsk !== null
      ? null
      : asks.first;
  return (
    <div data-auto-dock="" data-dock-row="" className="flex min-w-0 flex-col gap-2 empty:hidden">
      {!isHoldShown ? null : (
        <AutoDockHold sessionId={sessionId} view={view} rootAgent={rootAgent} actions={actions} />
      )}
      {plan === null || hasAskAbove ? null : (
        <AutoDockPlan
          sessionId={sessionId}
          dockPlan={plan}
          onOpen={onOpenArtifact}
          isApproveHidden={isRevisionAsked}
          isSettledHidden={AT_REST.has(view.tree.phase)}
          discardAsk={planDiscardAskOf({ view, row: plan.row })}
        />
      )}
      {!isNextShown ? null : (
        <AutoNextAction
          sessionId={sessionId}
          rootAgentId={view.tree.rootAgentId}
          action={nextStep.action}
          untold={untold[nextStep.action.delegationId] ?? null}
          onUntold={(content) =>
            setUntold((current) => {
              const rest = Object.fromEntries(
                Object.entries(current).filter(([id]) => id !== nextStep.action.delegationId),
              );
              return content === null ? rest : { ...rest, [nextStep.action.delegationId]: content };
            })
          }
        />
      )}
      {projectAsk === null ? null : (
        <AutoProjectAsk sessionId={sessionId} rootAgentId={rootAgent.id} ask={projectAsk} />
      )}
      {askBar === null ? null : (
        <AutoDockAsk
          sessionId={sessionId}
          view={view}
          rootAgent={rootAgent}
          bar={askBar}
          moreCount={asks.moreCount}
        />
      )}
      <AutoDockLive sessionId={sessionId} view={view} rootAgent={rootAgent} actions={actions} />
    </div>
  );
};
