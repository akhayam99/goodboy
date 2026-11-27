import { brandId, type Reminder, type SessionId } from '@goodboy/types';
import { liveAgentsOf } from '../../../store/runtime/live-work/liveAgentsOf';
import { sessionPullRequestOf } from '../../../store/slices/review-source/sessionPullRequestOf';
import type { AppState } from '../../../store/types';
import { pullRequestOfReminderId } from './pullRequestOfReminderId';

type Params = {
  readonly state: AppState;
  readonly reminder: Reminder;
  readonly now: number;
};

type TargetParams = {
  readonly state: AppState;
  readonly id: string;
};

type AgentParams = TargetParams & {
  readonly since: number;
};

type EventParams = TargetParams & {
  readonly now: number;
};

const isPullRequestGreen = ({ state, id }: TargetParams): boolean => {
  const target = pullRequestOfReminderId({ id });
  if (target === null) {
    return false;
  }
  const pr = sessionPullRequestOf({
    state,
    sessionId: target.sessionId,
    mountId: target.mountId,
    prNumber: target.prNumber,
  });
  return pr !== null && pr.number === target.prNumber && pr.checks === 'success';
};

const hasAgentFinished = ({ state, id, since }: AgentParams): boolean => {
  const sessionId = brandId<SessionId>({ value: id });
  const agents = state.sessionPhaseRuns[sessionId];
  if (agents === undefined || liveAgentsOf({ state, sessionId }).length > 0) {
    return false;
  }
  return agents.some((agent) => {
    const finishedAt = agent.lastFinishedAt === undefined ? NaN : Date.parse(agent.lastFinishedAt);
    return !Number.isNaN(finishedAt) && finishedAt >= since;
  });
};

const hasCallEnded = ({ state, id, now }: EventParams): boolean => {
  const event = state.calendarDay?.events.find((candidate) => candidate.id === id);
  return event !== undefined && event.end <= now;
};

export const isTriggerHeld = ({ state, reminder, now }: Params): boolean => {
  const { target } = reminder;
  if (reminder.doneAt !== null || reminder.dueAt !== null || target === null) {
    return false;
  }
  switch (reminder.trigger) {
    case 'time':
      return false;
    case 'ci_green':
      return target.kind === 'pull_request' && isPullRequestGreen({ state, id: target.id });
    case 'agent_done':
      return (
        target.kind === 'session' &&
        hasAgentFinished({ state, id: target.id, since: reminder.createdAt })
      );
    case 'call_end':
      return target.kind === 'event' && hasCallEnded({ state, id: target.id, now });
    default: {
      const unreachable: never = reminder.trigger;
      return unreachable;
    }
  }
};
