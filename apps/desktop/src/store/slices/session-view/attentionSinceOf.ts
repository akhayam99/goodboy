import type { Agent, Session, SessionAttentionReason } from '@goodboy/types';
import type { AppState } from '../../types';
import { agentHasUnread } from '../agents/agentHasUnread';

type AttentionSinceState = Pick<AppState, 'sessionPhaseRuns' | 'agentTurnState'> &
  Partial<Pick<AppState, 'sessionOpenQuestions' | 'sessionSlackDrafts'>>;

type Params = {
  readonly state: AttentionSinceState;
  readonly session: Session;
  readonly reason: SessionAttentionReason | null;
};

type TimeParams = {
  readonly value: string | null | undefined;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const msOf = ({ value }: TimeParams): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

type EarliestParams = {
  readonly times: ReadonlyArray<number | null>;
};

const earliestOf = ({ times }: EarliestParams): number | null => {
  const known = times.filter((time): time is number => time !== null);
  return known.length === 0 ? null : Math.min(...known);
};

export const attentionSinceOf = ({ state, session, reason }: Params): number | null => {
  const sessionId = session.id;
  const agents = state.sessionPhaseRuns[sessionId] ?? NO_AGENTS;
  if (reason === 'needs-approval') {
    return earliestOf({
      times: agents.map((agent) => {
        const turn = state.agentTurnState[agent.id];
        return turn?.kind === 'blocked' ? msOf({ value: turn.blockedAt }) : null;
      }),
    });
  }
  if (reason === 'agent-error') {
    return session.state.kind === 'error' ? msOf({ value: session.state.failedAt }) : null;
  }
  if (reason === 'open-question') {
    return earliestOf({
      times: (state.sessionOpenQuestions?.[sessionId] ?? [])
        .filter((question) => question.status === 'open')
        .map((question) => msOf({ value: question.createdAt })),
    });
  }
  if (reason === 'unread-reply') {
    return earliestOf({
      times: agents
        .filter((agent) => agentHasUnread(agent, false))
        .map((agent) => msOf({ value: agent.lastFinishedAt })),
    });
  }
  if (reason === 'slack-reply-waiting') {
    return earliestOf({
      times: (state.sessionSlackDrafts?.[sessionId] ?? [])
        .filter((draft) => draft.status === 'pending')
        .map((draft) => msOf({ value: draft.createdAt })),
    });
  }
  return null;
};
