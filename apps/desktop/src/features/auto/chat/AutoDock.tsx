import { useState } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { useConversationAsks } from '../../../store/hooks/useConversationAsks';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type { ConversationStop } from '../../../shared/types/conversationStop';
import { dockPlanRowOf } from '../dockPlanRowOf';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
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
  readonly stop: ConversationStop | null;
};

const AT_REST: ReadonlySet<AutoTreeView['tree']['phase']> = new Set([
  'answering',
  'done',
  'finished',
]);

export const AutoDock = ({ sessionId, view, rootAgent, onOpenArtifact, actions, stop }: Props) => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const { permissions, questions } = useConversationAsks({ sessionId, agentId: rootAgent.id });
  const [untold, setUntold] = useState<Readonly<Record<string, string>>>({});
  const hasAskAbove = permissions.length > 0 || questions.length > 0;
  const plan = dockPlanRowOf({ view });
  const isPlanWaiting = isAutoPlanAwaitingApproval({ view });
  const nextStep = dockNextStepOf({ view, agents, untold });
  const isRevisionAsked = nextStep !== null && nextStep.reviseOf === plan?.artifact.artifactId;
  const isNextShown = !hasAskAbove && nextStep !== null && (!isPlanWaiting || isRevisionAsked);
  const projectAsk = hasAskAbove || isPlanWaiting || isNextShown ? null : projectAskOf({ view });
  return (
    <div data-auto-dock="" data-dock-row="" className="flex min-w-0 flex-col gap-2 empty:hidden">
      {plan === null || hasAskAbove ? null : (
        <AutoDockPlan
          sessionId={sessionId}
          artifactId={plan.artifact.artifactId}
          title={plan.title}
          onOpen={onOpenArtifact}
          isApproveHidden={isRevisionAsked}
          isSettledHidden={AT_REST.has(view.tree.phase)}
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
      <AutoDockLive
        sessionId={sessionId}
        view={view}
        rootAgent={rootAgent}
        actions={actions}
        stop={stop}
      />
    </div>
  );
};
