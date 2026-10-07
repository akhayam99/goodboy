import type { Agent, Session, SessionAttentionReason, SessionId, TurnState } from '@goodboy/types';
import { agentPlace, branchPlace, sessionPlace } from '../../store';
import type { PlaceRequest } from '../../store/slices/navigation/types';
import { agentHasUnread } from '../../store/slices/agents/agentHasUnread';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';

type State = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionPhaseRuns: Readonly<Record<string, ReadonlyArray<Agent>>>;
  readonly agentTurnState: Readonly<Record<string, TurnState>>;
};

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

const latestAgent = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): Agent | null =>
  agents.reduce<Agent | null>(
    (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
    null,
  );

export const attentionPlace = ({ state, sessionId, reason }: Params): PlaceRequest => {
  if (reason === 'open-question') {
    return sessionPlace({ sessionId, lens: 'questions' });
  }
  if (reason === 'plan-approval') {
    const heldRun = state.sessions
      .find((session) => session.id === sessionId)
      ?.workflowRuns.find((run) => run.discardedAt == null && isRunHeldForPlan({ run }));
    if (heldRun === undefined) {
      return sessionPlace({ sessionId, lens: 'workflows' });
    }
    return sessionPlace({
      sessionId,
      lens: 'workflows',
      target: { kind: 'run', runId: heldRun.id },
    });
  }
  if (reason === 'ci-failed') {
    return branchPlace({ sessionId, tab: 'checks' });
  }
  if (
    reason === 'pr-approved' ||
    reason === 'changes-requested' ||
    reason === 'fix-needs-you' ||
    reason === 'fix-couldnt-fix'
  ) {
    return branchPlace({ sessionId, tab: 'comments' });
  }
  if (reason === null) {
    return sessionPlace({ sessionId });
  }

  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const target =
    reason === 'needs-approval'
      ? latestAgent({
          agents: agents.filter((agent) => state.agentTurnState[agent.id]?.kind === 'blocked'),
        })
      : reason === 'agent-error'
        ? latestAgent({ agents: agents.filter((agent) => agent.status === 'failed') })
        : reason === 'unread-reply'
          ? latestAgent({ agents: agents.filter((agent) => agentHasUnread(agent, false)) })
          : null;

  if (target === null) {
    return sessionPlace({ sessionId });
  }
  return agentPlace({ sessionId, agentId: target.id });
};
