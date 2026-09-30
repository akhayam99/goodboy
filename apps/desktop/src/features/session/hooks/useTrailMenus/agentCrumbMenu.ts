import type { Agent } from '@goodboy/types';
import type { CrumbMenuModel } from '@goodboy/ui';
import { agentHomeLens } from '../../agent-kind';
import { agentMenu } from '../../trail/menus/agentMenu';
import { stepMenu } from '../../trail/menus/stepMenu';
import { retryStepActions } from '../../trail/menus/crumbActions';
import { startAgentAction, stopStepActions } from './trailMenuActions';
import type { TrailMenuScope } from './trailMenuScope';

export const agentCrumbMenu = (scope: TrailMenuScope, agent: Agent): CrumbMenuModel | null => {
  const { sessionId, phaseRuns, attachedRuns, signals, resolvers, kindOf, stateOf, roleOf } = scope;
  if (agent.parentAgentId == null && agent.workflowRunId != null && agent.stepId != null) {
    const entry = attachedRuns.find(({ run }) => run.id === agent.workflowRunId) ?? null;
    if (entry === null) {
      return null;
    }
    const isTurnLive = signals.liveTurnAgentIds.has(agent.id);
    return stepMenu({
      workflow: entry.workflow,
      runId: entry.run.id,
      runTitle: scope.runTitleOf(entry),
      agents: phaseRuns,
      currentAgentId: agent.id,
      stateOf,
      roleLabelOf: (stepAgent, role) => (stepAgent !== null ? roleOf(stepAgent).label : role),
      modelOf: (stepAgent, stepModel) => stepAgent?.modelOverride ?? stepModel ?? 'Auto',
      actions: [
        ...stopStepActions({
          agent,
          isTurnLive,
          onStop: () => void scope.cancelCurrentTurn(sessionId, agent.id, 'user'),
        }),
        ...retryStepActions({
          agent,
          isTurnLive,
          onRetry: () =>
            void scope
              .recoverStuckStep({ sessionId, workflowRunId: entry.run.id })
              .catch((error: unknown) =>
                scope.reportError({ title: "Couldn't retry the step", error, sessionId }),
              ),
        }),
      ],
      onSelect: scope.toAgent,
    });
  }
  if (resolvers.has(agent.id)) {
    return null;
  }
  const kind = kindOf(agent);
  const peers =
    agent.parentAgentId != null
      ? phaseRuns.filter(
          (candidate) =>
            candidate.parentAgentId === agent.parentAgentId &&
            (kindOf(candidate) === kind || candidate.id === agent.id),
        )
      : phaseRuns.filter(
          (candidate) =>
            candidate.parentAgentId == null &&
            candidate.workflowRunId == null &&
            !resolvers.has(candidate.id) &&
            agentHomeLens({ agent: candidate, kind: kindOf(candidate) }) ===
              agentHomeLens({ agent, kind }),
        );
  return agentMenu({
    peers,
    currentAgentId: agent.id,
    stateOf,
    roleOf,
    modelOf: (peer) => peer.modelOverride ?? null,
    actions: agent.parentAgentId == null ? [startAgentAction({ sessionId })] : [],
    onSelect: scope.toAgent,
  });
};
